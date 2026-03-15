# input:  [Canvas LMS provider config/credential payloads and requests-based Canvas REST access]
# output: [Canvas-backed LMS provider adapter that validates connections, resolves user summaries, lists normalized courses, and reads assignments/calendar events]
# pos:    [Provider-specific adapter layer for the first LMS integration implementation]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from typing import Any, Optional
from urllib.parse import urlparse

import requests

from lms_providers import (
    LmsAssignmentSummaryData,
    LmsCalendarEventSummaryData,
    LmsConnectionSummaryData,
    LmsCoursePageData,
    LmsCourseSummaryData,
    LmsProviderError,
)


def normalize_canvas_base_url(raw_value: str) -> str:
    normalized = raw_value.strip().rstrip("/")
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise LmsProviderError("LMS_CONFIG_INVALID", "Canvas base_url must be a valid http or https URL.")
    if parsed.path.rstrip("/") == "/api/v1":
        raise LmsProviderError("LMS_CONFIG_INVALID", "Canvas base_url must not include the /api/v1 suffix.")
    if parsed.query or parsed.fragment:
        raise LmsProviderError("LMS_CONFIG_INVALID", "Canvas base_url must not include query parameters or fragments.")
    return normalized


class CanvasLmsProvider:
    provider = "canvas"

    def _build_session(self, config: dict[str, Any], credentials: dict[str, Any]) -> tuple[str, requests.Session]:
        base_url = normalize_canvas_base_url(str(config.get("base_url") or ""))
        token = str(credentials.get("personal_access_token") or "").strip()
        if not token:
            raise LmsProviderError("LMS_CREDENTIALS_INVALID", "Canvas personal_access_token is required.")

        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        })
        return base_url, session

    def _map_provider_exception(self, exc: Exception) -> LmsProviderError:
        if isinstance(exc, LmsProviderError):
            return exc
        if isinstance(exc, requests.HTTPError):
            status_code = exc.response.status_code if exc.response is not None else 502
            if status_code in {401, 403}:
                return LmsProviderError("LMS_CONNECTION_AUTH_FAILED", "Canvas rejected the personal access token.", status_code=422)
            if status_code == 404:
                return LmsProviderError("LMS_RESOURCE_NOT_FOUND", "Canvas resource was not found.", status_code=404)
            if status_code == 429:
                return LmsProviderError("LMS_CONNECTION_RATE_LIMITED", "Canvas rate-limited the request. Please retry later.", status_code=503)
            return LmsProviderError("LMS_PROVIDER_ERROR", "Canvas returned an unexpected provider error.", status_code=502)
        if isinstance(exc, requests.RequestException):
            return LmsProviderError("LMS_CONNECTION_UNREACHABLE", "Canvas could not be reached from the backend.", status_code=503)
        return LmsProviderError("LMS_PROVIDER_ERROR", "Canvas returned an unexpected provider error.", status_code=502)

    def _request_json(
        self,
        session: requests.Session,
        base_url: str,
        path: str,
        *,
        params: Optional[dict[str, Any]] = None,
    ) -> Any:
        response = session.get(f"{base_url}/api/v1{path}", params=params, timeout=30)
        response.raise_for_status()
        return response.json()

    def _paginate_json(
        self,
        session: requests.Session,
        base_url: str,
        path: str,
        *,
        params: Optional[dict[str, Any]] = None,
    ) -> list[dict[str, Any]]:
        next_url = f"{base_url}/api/v1{path}"
        next_params = dict(params or {})
        items: list[dict[str, Any]] = []

        while next_url:
            response = session.get(next_url, params=next_params, timeout=30)
            response.raise_for_status()
            payload = response.json()
            if isinstance(payload, list):
                items.extend(item for item in payload if isinstance(item, dict))
            next_url = response.links.get("next", {}).get("url")
            next_params = None

        return items

    def _normalize_summary(self, payload: dict[str, Any]) -> LmsConnectionSummaryData:
        return LmsConnectionSummaryData(
            external_user_id=str(payload.get("id") or ""),
            display_name=payload.get("name"),
            login_id=payload.get("login_id"),
            email=payload.get("primary_email") or payload.get("email"),
        )

    def _normalize_course(self, payload: dict[str, Any]) -> LmsCourseSummaryData:
        return LmsCourseSummaryData(
            external_id=str(payload.get("id") or ""),
            name=str(payload.get("name") or ""),
            course_code=payload.get("course_code"),
            workflow_state=payload.get("workflow_state"),
            start_at=payload.get("start_at"),
            end_at=payload.get("end_at"),
        )

    def _normalize_assignment(self, payload: dict[str, Any]) -> LmsAssignmentSummaryData:
        submission_types = payload.get("submission_types")
        return LmsAssignmentSummaryData(
            external_id=str(payload.get("id") or ""),
            title=str(payload.get("name") or "").strip() or "Assignment",
            description=payload.get("description"),
            due_at=payload.get("due_at"),
            unlock_at=payload.get("unlock_at"),
            lock_at=payload.get("lock_at"),
            html_url=payload.get("html_url"),
            published=bool(payload.get("published")),
            submission_types=[
                str(item).strip()
                for item in (submission_types if isinstance(submission_types, list) else [])
                if str(item).strip()
            ],
        )

    def _normalize_calendar_event(self, payload: dict[str, Any]) -> Optional[LmsCalendarEventSummaryData]:
        context_code = str(payload.get("context_code") or "").strip()
        if not context_code.startswith("course_"):
            return None

        start_at = payload.get("start_at")
        end_at = payload.get("end_at")
        if not start_at or not end_at:
            return None

        workflow_state = str(payload.get("workflow_state") or "").strip().upper()
        event_type_code = str(payload.get("type") or payload.get("workflow_state") or "LMS").strip().upper() or "LMS"

        return LmsCalendarEventSummaryData(
            external_id=str(payload.get("id") or ""),
            external_course_id=context_code.replace("course_", "", 1),
            title=str(payload.get("title") or payload.get("assignment", {}).get("name") or "LMS Event").strip() or "LMS Event",
            description=payload.get("description"),
            location=payload.get("location_name"),
            start_at=str(start_at),
            end_at=str(end_at),
            all_day=bool(payload.get("all_day")),
            html_url=payload.get("html_url"),
            event_type_code=workflow_state or event_type_code,
        )

    def validate_connection(self, config: dict[str, Any], credentials: dict[str, Any]) -> LmsConnectionSummaryData:
        try:
            base_url, session = self._build_session(config, credentials)
            payload = self._request_json(session, base_url, "/users/self/profile")
            if not isinstance(payload, dict):
                raise LmsProviderError("LMS_PROVIDER_ERROR", "Canvas returned an unexpected provider payload.", status_code=502)
            return self._normalize_summary(payload)
        except Exception as exc:
            raise self._map_provider_exception(exc) from exc

    def get_connection_summary(self, config: dict[str, Any], credentials: dict[str, Any]) -> LmsConnectionSummaryData:
        return self.validate_connection(config, credentials)

    def list_courses(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        *,
        page: int,
        page_size: int,
        workflow_state: Optional[str],
        enrollment_state: Optional[str],
    ) -> LmsCoursePageData:
        try:
            base_url, session = self._build_session(config, credentials)
            params: dict[str, Any] = {"per_page": 100}
            if enrollment_state:
                params["enrollment_state"] = enrollment_state
            payload = self._paginate_json(session, base_url, "/courses", params=params)
            normalized_courses = [self._normalize_course(item) for item in payload]
            if workflow_state:
                normalized_courses = [item for item in normalized_courses if item.workflow_state == workflow_state]

            start_index = max(0, (page - 1) * page_size)
            end_index = start_index + page_size + 1
            page_slice = normalized_courses[start_index:end_index]
            has_more = len(page_slice) > page_size
            items = page_slice[:page_size]
            return LmsCoursePageData(
                items=items,
                page=page,
                page_size=page_size,
                has_more=has_more,
                next_page=page + 1 if has_more else None,
            )
        except Exception as exc:
            raise self._map_provider_exception(exc) from exc

    def get_course(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> LmsCourseSummaryData:
        try:
            base_url, session = self._build_session(config, credentials)
            payload = self._request_json(session, base_url, f"/courses/{external_course_id}")
            if not isinstance(payload, dict):
                raise LmsProviderError("LMS_PROVIDER_ERROR", "Canvas returned an unexpected provider payload.", status_code=502)
            return self._normalize_course(payload)
        except Exception as exc:
            raise self._map_provider_exception(exc) from exc

    def list_assignments(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> list[LmsAssignmentSummaryData]:
        try:
            base_url, session = self._build_session(config, credentials)
            payload = self._paginate_json(
                session,
                base_url,
                f"/courses/{external_course_id}/assignments",
                params={"per_page": 100},
            )
            return [self._normalize_assignment(item) for item in payload]
        except Exception as exc:
            raise self._map_provider_exception(exc) from exc

    def list_calendar_events(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        *,
        context_codes: list[str],
        start_at: Optional[str],
        end_at: Optional[str],
    ) -> list[LmsCalendarEventSummaryData]:
        try:
            base_url, session = self._build_session(config, credentials)
            params: dict[str, Any] = {
                "per_page": 100,
                "all_events": True,
                "context_codes[]": context_codes,
            }
            if start_at:
                params["start_date"] = start_at
            if end_at:
                params["end_date"] = end_at
            payload = self._paginate_json(session, base_url, "/calendar_events", params=params)
            normalized_items = []
            for item in payload:
                normalized = self._normalize_calendar_event(item)
                if normalized is not None:
                    normalized_items.append(normalized)
            return normalized_items
        except Exception as exc:
            raise self._map_provider_exception(exc) from exc
