# input:  [SQLAlchemy session, LMS ORM models, CRUD/user-setting helpers, versioned crypto helpers, provider registry, and API schema payloads]
# output: [Provider-agnostic LMS integration, Program binding, Course link, import, assignment, and calendar service functions]
# pos:    [Backend LMS orchestration layer between HTTP routes, encrypted persistence, provider adapters, local Course/Program ownership rules, and local course-display-code mapping]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from datetime import datetime, timezone
import json
import re
from typing import Any, Iterable, Optional

from sqlalchemy.orm import Session

import color_utils
import crud
import models
import schemas
import utils
from lms_crypto import LmsCryptoError, decrypt_credentials, encrypt_credentials
from lms_providers import (
    LmsAssignmentSummaryData,
    LmsCalendarEventSummaryData,
    LmsConnectionSummaryData,
    LmsCoursePageData,
    LmsCourseSummaryData,
    LmsProviderError,
    get_lms_provider,
)


CANVAS_CALENDAR_CONTEXT_BATCH_SIZE = 10
COURSE_CODE_PATTERN = re.compile(r"\b([A-Za-z]{2,6})[\s-]*([0-9]{2,4}[A-Za-z0-9]*)\b")


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


def _touch_timestamps(record: Any) -> None:
    timestamp = _now_utc_iso()
    if getattr(record, "created_at", None) in (None, ""):
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


def _summary_to_schema(summary: LmsConnectionSummaryData) -> schemas.LmsConnectionSummary:
    return schemas.LmsConnectionSummary(
        external_user_id=summary.external_user_id,
        display_name=summary.display_name,
        login_id=summary.login_id,
        email=summary.email,
    )


def _integration_error(code: str | None, message: str | None) -> Optional[schemas.LmsIntegrationError]:
    if not code and not message:
        return None
    return schemas.LmsIntegrationError(
        code=code or "LMS_UNKNOWN_ERROR",
        message=message or "Unknown LMS integration error.",
    )


def _integration_to_schema(record: models.LmsIntegration) -> schemas.LmsIntegrationResponse:
    masked_api_key: Optional[str] = None
    if record.credentials_encrypted:
        try:
            masked_api_key = _provider_from_integration(record).mask_credentials(_credentials_from_record(record))
        except Exception:
            masked_api_key = None
    return schemas.LmsIntegrationResponse(
        id=record.id,
        display_name=record.display_name,
        provider=record.provider,
        status=record.status,
        config=_parse_json_dict(record.config_json),
        masked_api_key=masked_api_key,
        last_checked_at=record.last_checked_at,
        last_error=_integration_error(record.last_error_code, record.last_error_message),
        summary=None,
    )


def _course_page_to_schema(integration_id: str, page_data: LmsCoursePageData) -> schemas.LmsCourseListResponse:
    return schemas.LmsCourseListResponse(
        integration_id=integration_id,
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


def _course_link_to_schema(record: models.CourseLmsLink) -> schemas.LmsCourseLinkSummary:
    return schemas.LmsCourseLinkSummary(
        id=record.id,
        lms_integration_id=record.lms_integration_id,
        integration_display_name=record.integration_display_name,
        provider=record.provider,
        external_course_id=record.external_course_id,
        external_course_code=record.external_course_code,
        external_name=record.external_name,
        sync_enabled=bool(record.sync_enabled),
        last_synced_at=record.last_synced_at,
        last_error=_integration_error(record.last_error_code, record.last_error_message),
    )


def _resolve_course_display_code(course: models.Course) -> str:
    for candidate in [course.alias, course.name]:
        if not candidate:
            continue
        match = COURSE_CODE_PATTERN.search(candidate.strip())
        if match:
            return f"{match.group(1).upper()}{match.group(2).upper()}"
    subject_code = color_utils.resolve_subject_code(category=course.category, alias=course.alias, name=course.name)
    if subject_code:
        return subject_code
    if course.alias and course.alias.strip():
        return course.alias.strip()
    return course.name.strip()


def _calendar_identity(
    *,
    external_course_id: str,
    title: str,
    start_at: str,
    html_url: str | None,
    event_type_code: str,
) -> tuple[str, str, str, str, str]:
    return (
        external_course_id,
        (html_url or "").strip(),
        title.strip(),
        start_at.strip(),
        event_type_code.strip().upper(),
    )


def _assignment_to_calendar_event(
    course: models.Course,
    assignment: LmsAssignmentSummaryData,
) -> LmsCalendarEventSummaryData | None:
    if not assignment.due_at:
        return None
    return LmsCalendarEventSummaryData(
        external_id=f"assignment:{assignment.external_id}",
        external_course_id=course.lms_link.external_course_id,
        title=assignment.title,
        description=assignment.description,
        location=None,
        start_at=assignment.due_at,
        end_at=assignment.due_at,
        all_day=False,
        html_url=assignment.html_url,
        event_type_code="ASSIGNMENT",
    )


def _credentials_from_record(record: models.LmsIntegration) -> dict[str, Any]:
    if not record.credentials_encrypted:
        raise LmsServiceError("LMS_CREDENTIALS_MISSING", "Stored LMS credentials are missing.", status_code=500)
    try:
        return decrypt_credentials(record.credentials_encrypted)
    except Exception as exc:
        raise _map_lms_exception(exc) from exc


def _get_integration_record(db: Session, user_id: str, integration_id: str) -> Optional[models.LmsIntegration]:
    return (
        db.query(models.LmsIntegration)
        .filter(models.LmsIntegration.id == integration_id, models.LmsIntegration.user_id == user_id)
        .first()
    )


def _require_integration_record(db: Session, user_id: str, integration_id: str) -> models.LmsIntegration:
    record = _get_integration_record(db, user_id, integration_id)
    if record is None:
        raise LmsServiceError("LMS_INTEGRATION_NOT_FOUND", "LMS integration not found.", status_code=404)
    return record


def _get_program_record(db: Session, user_id: str, program_id: str) -> Optional[models.Program]:
    return (
        db.query(models.Program)
        .filter(models.Program.id == program_id, models.Program.owner_id == user_id)
        .first()
    )


def _require_program_record(db: Session, user_id: str, program_id: str) -> models.Program:
    program = _get_program_record(db, user_id, program_id)
    if program is None:
        raise LmsServiceError("PROGRAM_NOT_FOUND", "Program not found.", status_code=404)
    return program


def _require_program_integration(db: Session, user_id: str, program_id: str) -> tuple[models.Program, models.LmsIntegration]:
    program = _require_program_record(db, user_id, program_id)
    if not program.lms_integration_id:
        raise LmsServiceError("PROGRAM_LMS_NOT_CONFIGURED", "Program does not have an LMS integration configured.", status_code=422)
    integration = _require_integration_record(db, user_id, program.lms_integration_id)
    return program, integration


def _get_course_record(db: Session, user_id: str, course_id: str) -> Optional[models.Course]:
    return (
        db.query(models.Course)
        .join(models.Program, models.Course.program_id == models.Program.id)
        .filter(models.Course.id == course_id, models.Program.owner_id == user_id)
        .first()
    )


def _require_course_record(db: Session, user_id: str, course_id: str) -> models.Course:
    course = _get_course_record(db, user_id, course_id)
    if course is None:
        raise LmsServiceError("COURSE_NOT_FOUND", "Course not found.", status_code=404)
    return course


def _get_semester_record(db: Session, user_id: str, semester_id: str) -> Optional[models.Semester]:
    return (
        db.query(models.Semester)
        .join(models.Program, models.Semester.program_id == models.Program.id)
        .filter(models.Semester.id == semester_id, models.Program.owner_id == user_id)
        .first()
    )


def _require_semester_record(db: Session, user_id: str, semester_id: str) -> models.Semester:
    semester = _get_semester_record(db, user_id, semester_id)
    if semester is None:
        raise LmsServiceError("SEMESTER_NOT_FOUND", "Semester not found.", status_code=404)
    return semester


def _require_course_link(db: Session, course: models.Course) -> models.CourseLmsLink:
    if course.lms_link is None:
        raise LmsServiceError("COURSE_LMS_LINK_NOT_FOUND", "Course is not linked to an LMS course.", status_code=422)
    return course.lms_link


def _ensure_program_can_use_integration(program: models.Program, integration: models.LmsIntegration) -> None:
    if program.owner_id != integration.user_id:
        raise LmsServiceError("LMS_INTEGRATION_NOT_FOUND", "LMS integration not found.", status_code=404)


def _set_record_connected(record: models.LmsIntegration) -> None:
    record.status = "connected"
    record.last_checked_at = _now_utc_iso()
    record.last_error_code = None
    record.last_error_message = None
    _touch_timestamps(record)


def _set_record_error(record: models.LmsIntegration, error: LmsServiceError) -> None:
    record.status = "error"
    record.last_checked_at = _now_utc_iso()
    record.last_error_code = error.code
    record.last_error_message = error.message
    _touch_timestamps(record)


def _provider_from_integration(record: models.LmsIntegration):
    return get_lms_provider(record.provider)


def _integration_runtime(record: models.LmsIntegration) -> tuple[Any, dict[str, Any], dict[str, Any]]:
    return _provider_from_integration(record), _parse_json_dict(record.config_json), _credentials_from_record(record)


def _derive_course_category(course_summary: LmsCourseSummaryData) -> Optional[str]:
    if course_summary.course_code:
        derived = utils.extract_category(course_summary.course_code)
        if derived:
            return derived
    return utils.extract_category(course_summary.name)


def _chunked(values: Iterable[str], chunk_size: int) -> list[list[str]]:
    pending: list[str] = [item for item in values if item]
    return [pending[index:index + chunk_size] for index in range(0, len(pending), chunk_size)]


def list_integrations(db: Session, user_id: str) -> list[schemas.LmsIntegrationResponse]:
    records = (
        db.query(models.LmsIntegration)
        .filter(models.LmsIntegration.user_id == user_id)
        .order_by(models.LmsIntegration.display_name.asc(), models.LmsIntegration.created_at.asc())
        .all()
    )
    return [_integration_to_schema(record) for record in records]


def get_integration(db: Session, user_id: str, integration_id: str) -> schemas.LmsIntegrationResponse:
    return _integration_to_schema(_require_integration_record(db, user_id, integration_id))


def create_integration(
    db: Session,
    user_id: str,
    payload: schemas.LmsIntegrationCreateRequest,
) -> schemas.LmsIntegrationResponse:
    provider_impl = get_lms_provider(payload.provider)

    try:
        config = provider_impl.normalize_integration_config(payload.config)
        credentials = provider_impl.normalize_integration_credentials(payload.credentials)
        summary = provider_impl.validate_connection(config, credentials)
        encrypted_credentials = encrypt_credentials(credentials)
    except Exception as exc:
        raise _map_lms_exception(exc) from exc

    record = models.LmsIntegration(
        user_id=user_id,
        display_name=payload.display_name,
        provider=provider_impl.provider,
        config_json=json.dumps(config, separators=(",", ":"), sort_keys=True),
        credentials_encrypted=encrypted_credentials,
    )
    _set_record_connected(record)

    db.add(record)
    db.commit()
    db.refresh(record)

    response = _integration_to_schema(record)
    response.summary = _summary_to_schema(summary)
    return response


def update_integration(
    db: Session,
    user_id: str,
    integration_id: str,
    payload: schemas.LmsIntegrationUpdateRequest,
) -> schemas.LmsIntegrationResponse:
    record = _require_integration_record(db, user_id, integration_id)

    if payload.display_name is not None:
        record.display_name = payload.display_name

    summary = None
    if payload.config is not None or payload.credentials is not None:
        provider_impl = _provider_from_integration(record)
        try:
            config = (
                provider_impl.normalize_integration_config(payload.config)
                if payload.config is not None
                else _parse_json_dict(record.config_json)
            )
            credentials = (
                provider_impl.normalize_integration_credentials(payload.credentials)
                if payload.credentials is not None
                else _credentials_from_record(record)
            )
            summary = provider_impl.validate_connection(config, credentials)
            record.config_json = json.dumps(config, separators=(",", ":"), sort_keys=True)
            if payload.credentials is not None:
                record.credentials_encrypted = encrypt_credentials(credentials)
            _set_record_connected(record)
        except Exception as exc:
            raise _map_lms_exception(exc) from exc
    else:
        _touch_timestamps(record)

    db.add(record)
    db.commit()
    db.refresh(record)

    response = _integration_to_schema(record)
    if summary is not None:
        response.summary = _summary_to_schema(summary)
    return response


def validate_integration_draft(payload: schemas.LmsIntegrationValidationRequest) -> schemas.LmsIntegrationValidationResponse:
    provider_impl = get_lms_provider(payload.provider)
    try:
        config = provider_impl.normalize_integration_config(payload.config)
        credentials = provider_impl.normalize_integration_credentials(payload.credentials)
        summary = provider_impl.validate_connection(config, credentials)
    except Exception as exc:
        raise _map_lms_exception(exc) from exc
    return schemas.LmsIntegrationValidationResponse(
        provider=provider_impl.provider,
        status="connected",
        last_checked_at=_now_utc_iso(),
        last_error=None,
        summary=_summary_to_schema(summary),
    )


def validate_integration(
    db: Session,
    user_id: str,
    integration_id: str,
) -> schemas.LmsIntegrationValidationResponse:
    record = _require_integration_record(db, user_id, integration_id)
    provider_impl, config, credentials = _integration_runtime(record)

    try:
        summary = provider_impl.validate_connection(config, credentials)
        _set_record_connected(record)
        db.add(record)
        db.commit()
        db.refresh(record)
        return schemas.LmsIntegrationValidationResponse(
            provider=record.provider,
            status=record.status,
            last_checked_at=record.last_checked_at,
            last_error=None,
            summary=_summary_to_schema(summary),
        )
    except Exception as exc:
        mapped = _map_lms_exception(exc)
        _set_record_error(record, mapped)
        db.add(record)
        db.commit()
        raise mapped from exc


def delete_integration(db: Session, user_id: str, integration_id: str) -> None:
    record = _require_integration_record(db, user_id, integration_id)
    program_dependency = (
        db.query(models.Program)
        .filter(models.Program.lms_integration_id == integration_id, models.Program.owner_id == user_id)
        .first()
    )
    if program_dependency is not None:
        raise LmsServiceError(
            "LMS_INTEGRATION_IN_USE",
            "LMS integration is still assigned to a Program and cannot be deleted.",
            status_code=409,
        )
    course_link_dependency = (
        db.query(models.CourseLmsLink)
        .join(models.Program, models.CourseLmsLink.program_id == models.Program.id)
        .filter(models.CourseLmsLink.lms_integration_id == integration_id, models.Program.owner_id == user_id)
        .first()
    )
    if course_link_dependency is not None:
        raise LmsServiceError(
            "LMS_INTEGRATION_IN_USE",
            "LMS integration still has linked courses and cannot be deleted.",
            status_code=409,
        )
    db.delete(record)
    db.commit()


def list_courses_for_integration(
    db: Session,
    user_id: str,
    integration_id: str,
    *,
    page: int,
    page_size: int,
    workflow_state: Optional[str],
    enrollment_state: Optional[str],
) -> schemas.LmsCourseListResponse:
    record = _require_integration_record(db, user_id, integration_id)
    provider_impl, config, credentials = _integration_runtime(record)
    try:
        page_data = provider_impl.list_courses(
            config,
            credentials,
            page=page,
            page_size=page_size,
            workflow_state=workflow_state,
            enrollment_state=enrollment_state,
        )
        _set_record_connected(record)
        db.add(record)
        db.commit()
        return _course_page_to_schema(record.id, page_data)
    except Exception as exc:
        mapped = _map_lms_exception(exc)
        _set_record_error(record, mapped)
        db.add(record)
        db.commit()
        raise mapped from exc


def list_program_courses(
    db: Session,
    user_id: str,
    program_id: str,
    *,
    page: int,
    page_size: int,
    workflow_state: Optional[str],
    enrollment_state: Optional[str],
) -> schemas.LmsCourseListResponse:
    program, integration = _require_program_integration(db, user_id, program_id)
    _ensure_program_can_use_integration(program, integration)
    return list_courses_for_integration(
        db,
        user_id,
        integration.id,
        page=page,
        page_size=page_size,
        workflow_state=workflow_state,
        enrollment_state=enrollment_state,
    )


def _fetch_external_course(record: models.LmsIntegration, external_course_id: str) -> LmsCourseSummaryData:
    provider_impl, config, credentials = _integration_runtime(record)
    try:
        return provider_impl.get_course(config, credentials, external_course_id)
    except Exception as exc:
        raise _map_lms_exception(exc) from exc


def _populate_course_link_from_summary(link: models.CourseLmsLink, course_summary: LmsCourseSummaryData) -> None:
    link.external_course_code = course_summary.course_code
    link.external_name = course_summary.name
    link.last_synced_at = _now_utc_iso()
    link.last_error_code = None
    link.last_error_message = None
    _touch_timestamps(link)


def get_course_link(db: Session, user_id: str, course_id: str) -> Optional[schemas.LmsCourseLinkSummary]:
    course = _require_course_record(db, user_id, course_id)
    if course.lms_link is None:
        return None
    return _course_link_to_schema(course.lms_link)


def upsert_course_link(
    db: Session,
    user_id: str,
    course_id: str,
    payload: schemas.LmsCourseLinkUpdateRequest,
) -> schemas.LmsCourseLinkSummary:
    course = _require_course_record(db, user_id, course_id)
    program = _require_program_record(db, user_id, course.program_id)
    if not program.lms_integration_id:
        raise LmsServiceError("PROGRAM_LMS_NOT_CONFIGURED", "Program does not have an LMS integration configured.", status_code=422)
    integration = _require_integration_record(db, user_id, program.lms_integration_id)

    existing_conflict = (
        db.query(models.CourseLmsLink)
        .filter(
            models.CourseLmsLink.program_id == program.id,
            models.CourseLmsLink.lms_integration_id == integration.id,
            models.CourseLmsLink.external_course_id == payload.external_course_id,
            models.CourseLmsLink.course_id != course.id,
        )
        .first()
    )
    if existing_conflict is not None:
        raise LmsServiceError(
            "COURSE_LMS_LINK_CONFLICT",
            "This LMS course is already linked to another Course in the Program.",
            status_code=409,
        )

    course_summary = _fetch_external_course(integration, payload.external_course_id)
    link = course.lms_link or models.CourseLmsLink(
        course_id=course.id,
        program_id=program.id,
        lms_integration_id=integration.id,
        external_course_id=payload.external_course_id,
    )
    link.program_id = program.id
    link.lms_integration_id = integration.id
    link.external_course_id = payload.external_course_id
    link.sync_enabled = bool(payload.sync_enabled)
    _populate_course_link_from_summary(link, course_summary)

    db.add(link)
    db.commit()
    db.refresh(link)
    return _course_link_to_schema(link)


def sync_course_link(
    db: Session,
    user_id: str,
    course_id: str,
    payload: Optional[schemas.LmsCourseLinkSyncRequest] = None,
) -> schemas.LmsCourseLinkSummary:
    course = _require_course_record(db, user_id, course_id)
    link = _require_course_link(db, course)
    integration = _require_integration_record(db, user_id, link.lms_integration_id)
    if payload and payload.sync_enabled is not None:
        link.sync_enabled = bool(payload.sync_enabled)

    try:
        course_summary = _fetch_external_course(integration, link.external_course_id)
        _populate_course_link_from_summary(link, course_summary)
    except Exception as exc:
        mapped = _map_lms_exception(exc)
        link.last_error_code = mapped.code
        link.last_error_message = mapped.message
        _touch_timestamps(link)
        db.add(link)
        db.commit()
        raise mapped from exc

    db.add(link)
    db.commit()
    db.refresh(link)
    return _course_link_to_schema(link)


def delete_course_link(db: Session, user_id: str, course_id: str) -> None:
    course = _require_course_record(db, user_id, course_id)
    link = _require_course_link(db, course)
    db.delete(link)
    db.commit()


def _build_import_result(
    external_course_id: str,
    *,
    status: str,
    course: Optional[models.Course] = None,
    error: Optional[LmsServiceError] = None,
) -> schemas.LmsCourseImportResult:
    return schemas.LmsCourseImportResult(
        external_course_id=external_course_id,
        status=status,
        course=schemas.Course.model_validate(course, from_attributes=True) if course is not None else None,
        error=schemas.LmsIntegrationError(code=error.code, message=error.message) if error is not None else None,
    )


def import_program_courses(
    db: Session,
    user_id: str,
    program_id: str,
    payload: schemas.LmsCourseImportRequest,
) -> schemas.LmsCourseImportResponse:
    program, integration = _require_program_integration(db, user_id, program_id)
    semester = None
    if payload.semester_id is not None:
        semester = _require_semester_record(db, user_id, payload.semester_id)
        if semester.program_id != program.id:
            raise LmsServiceError("SEMESTER_PROGRAM_MISMATCH", "Semester does not belong to the target Program.", status_code=422)

    user = crud.get_user(db, user_id)
    default_credit = float(crud.get_user_setting_dict(user).get("default_course_credit", crud.DEFAULT_COURSE_CREDIT))
    results: list[schemas.LmsCourseImportResult] = []

    for external_course_id in payload.external_course_ids:
        existing_conflict = (
            db.query(models.CourseLmsLink)
            .filter(
                models.CourseLmsLink.program_id == program.id,
                models.CourseLmsLink.lms_integration_id == integration.id,
                models.CourseLmsLink.external_course_id == external_course_id,
            )
            .first()
        )
        if existing_conflict is not None:
            results.append(
                _build_import_result(
                    external_course_id,
                    status="conflict",
                    error=LmsServiceError(
                        "COURSE_LMS_LINK_CONFLICT",
                        "This LMS course is already linked to another Course in the Program.",
                        status_code=409,
                    ),
                )
            )
            continue

        try:
            course_summary = _fetch_external_course(integration, external_course_id)
            course = crud.create_course(
                db=db,
                course=schemas.CourseCreate(
                    name=course_summary.name,
                    alias=course_summary.course_code,
                    category=_derive_course_category(course_summary),
                    credits=default_credit,
                ),
                program_id=program.id,
                semester_id=semester.id if semester is not None else None,
            )
            link = models.CourseLmsLink(
                course_id=course.id,
                program_id=program.id,
                lms_integration_id=integration.id,
                external_course_id=external_course_id,
                sync_enabled=True,
            )
            _populate_course_link_from_summary(link, course_summary)
            db.add(link)
            db.commit()
            db.refresh(course)
            results.append(_build_import_result(external_course_id, status="created", course=course))
        except Exception as exc:
            mapped = _map_lms_exception(exc)
            db.rollback()
            results.append(_build_import_result(external_course_id, status="conflict", error=mapped))

    return schemas.LmsCourseImportResponse(integration_id=integration.id, results=results)


def import_semester_with_courses(
    db: Session,
    user_id: str,
    program_id: str,
    payload: schemas.LmsSemesterImportRequest,
) -> tuple[schemas.Semester, schemas.LmsCourseImportResponse]:
    program, integration = _require_program_integration(db, user_id, program_id)
    resolved_start_date, resolved_end_date = crud.get_default_semester_dates()
    start_date = payload.start_date or resolved_start_date
    end_date = payload.end_date or resolved_end_date

    semester = crud.create_semester(
        db,
        schemas.SemesterCreate(
            name=payload.name,
            start_date=start_date,
            end_date=end_date,
            reading_week_start=payload.reading_week_start,
            reading_week_end=payload.reading_week_end,
        ),
        program.id,
    )
    import_response = import_program_courses(
        db,
        user_id,
        program_id,
        schemas.LmsCourseImportRequest(
            external_course_ids=payload.external_course_ids,
            semester_id=semester.id,
        ),
    )
    return schemas.Semester.model_validate(semester, from_attributes=True), import_response


def list_course_assignments(
    db: Session,
    user_id: str,
    course_id: str,
) -> schemas.LmsAssignmentListResponse:
    course = _require_course_record(db, user_id, course_id)
    link = _require_course_link(db, course)
    integration = _require_integration_record(db, user_id, link.lms_integration_id)
    provider_impl, config, credentials = _integration_runtime(integration)
    try:
        assignments = provider_impl.list_assignments(config, credentials, link.external_course_id)
        _set_record_connected(integration)
        link.last_error_code = None
        link.last_error_message = None
        link.last_synced_at = _now_utc_iso()
        _touch_timestamps(link)
        db.add(integration)
        db.add(link)
        db.commit()
        return schemas.LmsAssignmentListResponse(
            items=[
                schemas.LmsAssignmentSummary(
                    external_id=item.external_id,
                    course_id=course.id,
                    course_name=course.name,
                    course_display_code=_resolve_course_display_code(course),
                    title=item.title,
                    description=item.description,
                    due_at=item.due_at,
                    due_date=item.due_date,
                    unlock_at=item.unlock_at,
                    lock_at=item.lock_at,
                    html_url=item.html_url,
                    published=item.published,
                    submission_types=item.submission_types,
                )
                for item in assignments
            ]
        )
    except Exception as exc:
        mapped = _map_lms_exception(exc)
        _set_record_error(integration, mapped)
        link.last_error_code = mapped.code
        link.last_error_message = mapped.message
        _touch_timestamps(link)
        db.add(integration)
        db.add(link)
        db.commit()
        raise mapped from exc


def list_semester_assignments(
    db: Session,
    user_id: str,
    semester_id: str,
) -> schemas.LmsAssignmentListResponse:
    semester = _require_semester_record(db, user_id, semester_id)
    items: list[schemas.LmsAssignmentSummary] = []
    for course in semester.courses:
        if course.lms_link is None:
            continue
        response = list_course_assignments(db, user_id, course.id)
        items.extend(response.items)
    return schemas.LmsAssignmentListResponse(items=items)


def list_semester_calendar_events(
    db: Session,
    user_id: str,
    semester_id: str,
) -> schemas.LmsCalendarEventListResponse:
    semester = _require_semester_record(db, user_id, semester_id)
    program = _require_program_record(db, user_id, semester.program_id)
    if not program.lms_integration_id:
        raise LmsServiceError("PROGRAM_LMS_NOT_CONFIGURED", "Program does not have an LMS integration configured.", status_code=422)
    integration = _require_integration_record(db, user_id, program.lms_integration_id)

    linked_courses = [course for course in semester.courses if course.lms_link is not None and course.lms_link.sync_enabled]
    if not linked_courses:
        return schemas.LmsCalendarEventListResponse(items=[])

    external_course_map = {course.lms_link.external_course_id: course for course in linked_courses}
    context_codes = [f"course_{external_id}" for external_id in external_course_map.keys()]
    provider_impl, config, credentials = _integration_runtime(integration)
    start_at = semester.start_date.isoformat() if semester.start_date is not None else None
    end_at = semester.end_date.isoformat() if semester.end_date is not None else None

    try:
        provider_events: list[LmsCalendarEventSummaryData] = []
        for batch in _chunked(context_codes, CANVAS_CALENDAR_CONTEXT_BATCH_SIZE):
            provider_events.extend(
                provider_impl.list_calendar_events(
                    config,
                    credentials,
                    context_codes=batch,
                    start_at=start_at,
                    end_at=end_at,
                )
            )
        assignment_events: list[LmsCalendarEventSummaryData] = []
        for course in linked_courses:
            assignments = provider_impl.list_assignments(
                config,
                credentials,
                course.lms_link.external_course_id,
            )
            for assignment in assignments:
                normalized = _assignment_to_calendar_event(course, assignment)
                if normalized is not None:
                    assignment_events.append(normalized)
        _set_record_connected(integration)
        db.add(integration)
        for course in linked_courses:
            course.lms_link.last_error_code = None
            course.lms_link.last_error_message = None
            course.lms_link.last_synced_at = _now_utc_iso()
            _touch_timestamps(course.lms_link)
            db.add(course.lms_link)
        db.commit()
    except Exception as exc:
        mapped = _map_lms_exception(exc)
        _set_record_error(integration, mapped)
        db.add(integration)
        for course in linked_courses:
            course.lms_link.last_error_code = mapped.code
            course.lms_link.last_error_message = mapped.message
            _touch_timestamps(course.lms_link)
            db.add(course.lms_link)
        db.commit()
        raise mapped from exc

    merged_events: list[LmsCalendarEventSummaryData] = []
    seen_identities: set[tuple[str, str, str, str, str]] = set()
    for item in [*provider_events, *assignment_events]:
        identity = _calendar_identity(
            external_course_id=item.external_course_id,
            title=item.title,
            start_at=item.start_at,
            html_url=item.html_url,
            event_type_code=item.event_type_code,
        )
        if identity in seen_identities:
            continue
        seen_identities.add(identity)
        merged_events.append(item)

    items: list[schemas.LmsCalendarEventSummary] = []
    for item in merged_events:
        course = external_course_map.get(item.external_course_id)
        if course is None:
            continue
        items.append(
                schemas.LmsCalendarEventSummary(
                    external_id=item.external_id,
                    source_id=f"lms:{integration.id}",
                    course_id=course.id,
                    course_name=course.name,
                    course_display_code=_resolve_course_display_code(course),
                    title=item.title,
                description=item.description,
                location=item.location,
                start_at=item.start_at,
                end_at=item.end_at,
                all_day=item.all_day,
                html_url=item.html_url,
                event_type_code=item.event_type_code,
            )
        )

    return schemas.LmsCalendarEventListResponse(items=items)
