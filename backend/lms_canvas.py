# input:  [Canvas LMS provider config/credential payloads, canvasapi runtime dependency, and requests-level connectivity failures]
# output: [Canvas-backed LMS provider adapter that validates connections, resolves user summaries, and lists normalized courses]
# pos:    [Provider-specific adapter layer for the first LMS integration implementation]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from typing import Any, Optional
from urllib.parse import urlparse

import requests

from lms_providers import LmsConnectionSummaryData, LmsCoursePageData, LmsCourseSummaryData, LmsProviderError


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

    def _load_canvas_client(self, config: dict[str, Any], credentials: dict[str, Any]):
        base_url = normalize_canvas_base_url(str(config.get("base_url") or ""))
        token = str(credentials.get("personal_access_token") or "").strip()
        if not token:
            raise LmsProviderError("LMS_CREDENTIALS_INVALID", "Canvas personal_access_token is required.")

        try:
            from canvasapi import Canvas
            from canvasapi.exceptions import (
                CanvasException,
                Forbidden,
                InvalidAccessToken,
                RateLimitExceeded,
                Unauthorized,
            )
        except ImportError as exc:
            raise LmsProviderError(
                "LMS_PROVIDER_DEPENDENCY_MISSING",
                "canvasapi must be installed before Canvas LMS integrations can be used.",
                status_code=500,
            ) from exc

        canvas = Canvas(base_url, token)
        return canvas, {
            "CanvasException": CanvasException,
            "Forbidden": Forbidden,
            "InvalidAccessToken": InvalidAccessToken,
            "RateLimitExceeded": RateLimitExceeded,
            "Unauthorized": Unauthorized,
        }

    def _map_provider_exception(self, exc: Exception, exception_types: dict[str, type[Exception]]) -> LmsProviderError:
        if isinstance(exc, (exception_types["InvalidAccessToken"], exception_types["Unauthorized"])):
            return LmsProviderError("LMS_CONNECTION_AUTH_FAILED", "Canvas rejected the personal access token.", status_code=422)
        if isinstance(exc, exception_types["Forbidden"]):
            return LmsProviderError("LMS_CONNECTION_FORBIDDEN", "Canvas authenticated the token but denied this request.", status_code=403)
        if isinstance(exc, exception_types["RateLimitExceeded"]):
            return LmsProviderError("LMS_CONNECTION_RATE_LIMITED", "Canvas rate-limited the request. Please retry later.", status_code=503)
        if isinstance(exc, requests.exceptions.RequestException):
            return LmsProviderError("LMS_CONNECTION_UNREACHABLE", "Canvas could not be reached from the backend.", status_code=503)
        if isinstance(exc, exception_types["CanvasException"]):
            return LmsProviderError("LMS_PROVIDER_ERROR", "Canvas returned an unexpected provider error.", status_code=502)
        return LmsProviderError("LMS_PROVIDER_ERROR", "Canvas returned an unexpected provider error.", status_code=502)

    def _get_current_user(self, config: dict[str, Any], credentials: dict[str, Any]):
        canvas, exception_types = self._load_canvas_client(config, credentials)
        try:
            return canvas.get_current_user(), exception_types
        except Exception as exc:
            raise self._map_provider_exception(exc, exception_types) from exc

    def _normalize_summary(self, user: Any) -> LmsConnectionSummaryData:
        return LmsConnectionSummaryData(
            external_user_id=str(getattr(user, "id", "")),
            display_name=getattr(user, "name", None),
            login_id=getattr(user, "login_id", None),
            email=getattr(user, "primary_email", None) or getattr(user, "email", None),
        )

    def _normalize_course(self, course: Any) -> LmsCourseSummaryData:
        return LmsCourseSummaryData(
            external_id=str(getattr(course, "id", "")),
            name=str(getattr(course, "name", "") or ""),
            course_code=getattr(course, "course_code", None),
            workflow_state=getattr(course, "workflow_state", None),
            start_at=getattr(course, "start_at", None),
            end_at=getattr(course, "end_at", None),
        )

    def validate_connection(self, config: dict[str, Any], credentials: dict[str, Any]) -> LmsConnectionSummaryData:
        user, _exception_types = self._get_current_user(config, credentials)
        return self._normalize_summary(user)

    def get_connection_summary(self, config: dict[str, Any], credentials: dict[str, Any]) -> LmsConnectionSummaryData:
        user, _exception_types = self._get_current_user(config, credentials)
        return self._normalize_summary(user)

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
        user, exception_types = self._get_current_user(config, credentials)

        course_kwargs: dict[str, Any] = {}
        if enrollment_state:
            course_kwargs["enrollment_state"] = enrollment_state

        try:
            normalized_courses = [self._normalize_course(course) for course in user.get_courses(**course_kwargs)]
        except Exception as exc:
            raise self._map_provider_exception(exc, exception_types) from exc

        if workflow_state:
            normalized_courses = [course for course in normalized_courses if course.workflow_state == workflow_state]

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
