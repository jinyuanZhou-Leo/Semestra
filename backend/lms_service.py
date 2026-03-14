# input:  [SQLAlchemy session, LMS ORM model, versioned crypto helpers, provider registry, and API schema payloads]
# output: [Provider-agnostic LMS integration service functions for connect, validate, inspect, disconnect, and course reads]
# pos:    [Backend LMS orchestration layer between HTTP routes, encrypted persistence, and provider adapters]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from datetime import datetime, timezone
import json
from typing import Any, Optional

from sqlalchemy.orm import Session

import models
import schemas
from lms_crypto import LmsCryptoError, decrypt_credentials, encrypt_credentials
from lms_providers import (
    LmsConnectionSummaryData,
    LmsCoursePageData,
    LmsProviderError,
    get_lms_provider,
)


class LmsServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 422) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_json_dict(raw_value: str | None) -> dict[str, Any]:
    if not raw_value:
        return {}
    try:
        parsed = json.loads(raw_value)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _touch_timestamps(record: models.LmsIntegration) -> None:
    timestamp = _now_utc_iso()
    if not record.created_at:
        record.created_at = timestamp
    record.updated_at = timestamp


def _map_lms_exception(exc: Exception) -> LmsServiceError:
    if isinstance(exc, LmsServiceError):
        return exc
    if isinstance(exc, LmsProviderError):
        return LmsServiceError(exc.code, exc.message, exc.status_code)
    if isinstance(exc, LmsCryptoError):
        return LmsServiceError(exc.code, exc.message, status_code=500)
    return LmsServiceError("LMS_INTERNAL_ERROR", "Unexpected LMS integration error.", status_code=500)


def _get_integration_record(db: Session, user_id: str, provider: str) -> Optional[models.LmsIntegration]:
    return (
        db.query(models.LmsIntegration)
        .filter(models.LmsIntegration.user_id == user_id, models.LmsIntegration.provider == provider)
        .first()
    )


def _require_integration_record(db: Session, user_id: str, provider: str) -> models.LmsIntegration:
    record = _get_integration_record(db, user_id, provider)
    if record is None:
        raise LmsServiceError("LMS_INTEGRATION_NOT_FOUND", f"No stored LMS integration exists for provider '{provider}'.", status_code=404)
    return record


def _credentials_from_record(record: models.LmsIntegration) -> dict[str, Any]:
    if not record.credentials_encrypted:
        raise LmsServiceError("LMS_CREDENTIALS_MISSING", "Stored LMS credentials are missing.", status_code=500)
    try:
        return decrypt_credentials(record.credentials_encrypted)
    except Exception as exc:
        raise _map_lms_exception(exc) from exc


def _summary_to_schema(summary: LmsConnectionSummaryData) -> schemas.LmsConnectionSummary:
    return schemas.LmsConnectionSummary(
        external_user_id=summary.external_user_id,
        display_name=summary.display_name,
        login_id=summary.login_id,
        email=summary.email,
    )


def _integration_to_schema(record: models.LmsIntegration) -> schemas.LmsIntegrationResponse:
    last_error = None
    if record.last_error_code or record.last_error_message:
        last_error = schemas.LmsIntegrationError(
            code=record.last_error_code or "LMS_UNKNOWN_ERROR",
            message=record.last_error_message or "Unknown LMS integration error.",
        )
    return schemas.LmsIntegrationResponse(
        provider=record.provider,
        status=record.status,
        config=_parse_json_dict(record.config_json),
        last_checked_at=record.last_checked_at,
        last_error=last_error,
        summary=None,
    )


def _course_page_to_schema(page_data: LmsCoursePageData) -> schemas.LmsCourseListResponse:
    return schemas.LmsCourseListResponse(
        items=[
            schemas.LmsCourseSummary(
                external_id=item.external_id,
                name=item.name,
                course_code=item.course_code,
                workflow_state=item.workflow_state,
                start_at=item.start_at,
                end_at=item.end_at,
            )
            for item in page_data.items
        ],
        page=page_data.page,
        page_size=page_data.page_size,
        has_more=page_data.has_more,
        next_page=page_data.next_page,
    )


def list_integrations(db: Session, user_id: str) -> list[schemas.LmsIntegrationResponse]:
    records = (
        db.query(models.LmsIntegration)
        .filter(models.LmsIntegration.user_id == user_id)
        .order_by(models.LmsIntegration.provider.asc())
        .all()
    )
    return [_integration_to_schema(record) for record in records]


def get_integration(db: Session, user_id: str, provider: str) -> schemas.LmsIntegrationResponse:
    provider_impl = get_lms_provider(provider)
    record = _require_integration_record(db, user_id, provider_impl.provider)
    return _integration_to_schema(record)


def upsert_integration(
    db: Session,
    user_id: str,
    provider: str,
    payload: schemas.LmsIntegrationUpsertRequest,
) -> schemas.LmsIntegrationResponse:
    provider_impl = get_lms_provider(provider)

    try:
        summary = provider_impl.validate_connection(payload.config, payload.credentials)
        encrypted_credentials = encrypt_credentials(payload.credentials)
    except Exception as exc:
        raise _map_lms_exception(exc) from exc

    record = _get_integration_record(db, user_id, provider)
    if record is None:
        record = models.LmsIntegration(user_id=user_id, provider=provider_impl.provider)

    record.status = "connected"
    record.config_json = json.dumps(payload.config, separators=(",", ":"), sort_keys=True)
    record.credentials_encrypted = encrypted_credentials
    record.last_checked_at = _now_utc_iso()
    record.last_error_code = None
    record.last_error_message = None
    _touch_timestamps(record)

    db.add(record)
    db.commit()
    db.refresh(record)

    response = _integration_to_schema(record)
    response.summary = _summary_to_schema(summary)
    return response


def validate_integration(
    db: Session,
    user_id: str,
    provider: str,
    payload: Optional[schemas.LmsIntegrationValidationRequest],
) -> schemas.LmsIntegrationValidationResponse:
    provider_impl = get_lms_provider(provider)

    if payload is not None:
        try:
            summary = provider_impl.validate_connection(payload.config, payload.credentials)
        except Exception as exc:
            raise _map_lms_exception(exc) from exc
        return schemas.LmsIntegrationValidationResponse(
            provider=provider_impl.provider,
            status="connected",
            last_checked_at=_now_utc_iso(),
            last_error=None,
            summary=_summary_to_schema(summary),
        )

    record = _require_integration_record(db, user_id, provider_impl.provider)
    config = _parse_json_dict(record.config_json)
    credentials = _credentials_from_record(record)
    checked_at = _now_utc_iso()

    try:
        summary = provider_impl.validate_connection(config, credentials)
        record.status = "connected"
        record.last_checked_at = checked_at
        record.last_error_code = None
        record.last_error_message = None
        _touch_timestamps(record)
        db.add(record)
        db.commit()
        db.refresh(record)
        return schemas.LmsIntegrationValidationResponse(
            provider=provider_impl.provider,
            status=record.status,
            last_checked_at=record.last_checked_at,
            last_error=None,
            summary=_summary_to_schema(summary),
        )
    except Exception as exc:
        mapped = _map_lms_exception(exc)
        record.status = "error"
        record.last_checked_at = checked_at
        record.last_error_code = mapped.code
        record.last_error_message = mapped.message
        _touch_timestamps(record)
        db.add(record)
        db.commit()
        raise mapped from exc


def list_courses(
    db: Session,
    user_id: str,
    provider: str,
    *,
    page: int,
    page_size: int,
    workflow_state: Optional[str],
    enrollment_state: Optional[str],
) -> schemas.LmsCourseListResponse:
    provider_impl = get_lms_provider(provider)
    record = _require_integration_record(db, user_id, provider_impl.provider)
    config = _parse_json_dict(record.config_json)
    credentials = _credentials_from_record(record)
    checked_at = _now_utc_iso()

    try:
        course_page = provider_impl.list_courses(
            config,
            credentials,
            page=page,
            page_size=page_size,
            workflow_state=workflow_state,
            enrollment_state=enrollment_state,
        )
        record.status = "connected"
        record.last_checked_at = checked_at
        record.last_error_code = None
        record.last_error_message = None
        _touch_timestamps(record)
        db.add(record)
        db.commit()
        return _course_page_to_schema(course_page)
    except Exception as exc:
        mapped = _map_lms_exception(exc)
        record.status = "error"
        record.last_checked_at = checked_at
        record.last_error_code = mapped.code
        record.last_error_message = mapped.message
        _touch_timestamps(record)
        db.add(record)
        db.commit()
        raise mapped from exc


def delete_integration(db: Session, user_id: str, provider: str) -> None:
    provider_impl = get_lms_provider(provider)
    record = _require_integration_record(db, user_id, provider_impl.provider)
    db.delete(record)
    db.commit()
