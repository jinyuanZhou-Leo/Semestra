# input:  [Canvas LMS provider config/credential payloads, requests-based Canvas REST access, and Canvas file metadata/download endpoints]
# output: [Canvas-backed LMS provider adapter that normalizes integration config/credentials, blocks SSRF-prone hosts or redirects, masks stored credentials, validates connections, resolves user summaries, lists normalized courses/navigation/announcements/module summaries with inline item payloads/module items/pages/quizzes/grades, reads syllabus/assignments/calendar events, fetches file metadata/content, and applies provider-specific due-date normalization plus module-item target typing and content-details capture]
# pos:    [Provider-specific adapter layer for the first LMS integration implementation, including Canvas-to-provider-neutral field, outbound-target hardening, navigation, page, announcement, module summary/item, quiz, grade, syllabus, file proxy/download, inline module item hydration for the summary response, and credential mapping with normalized module-item target metadata]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from datetime import datetime
import ipaddress
import socket
from typing import Any, Iterator, Optional
from urllib.parse import urljoin, urlparse

import requests

from lms_providers import (
    LmsAssignmentSummaryData,
    LmsAnnouncementSummaryData,
    LmsCalendarEventSummaryData,
    LmsConnectionSummaryData,
    LmsCourseFileData,
    LmsCourseFileStreamData,
    LmsCoursePageData,
    LmsCourseNavigationData,
    LmsCourseNavigationTabData,
    LmsCourseSyllabusData,
    LmsCourseSummaryData,
    LmsGradeSummaryData,
    LmsModuleItemData,
    LmsModuleSummaryData,
    LmsPageDetailData,
    LmsPageSummaryData,
    LmsProviderError,
    LmsQuizSummaryData,
)

CANVAS_API_PREFIX = "/api/v1"
CANVAS_REQUEST_TIMEOUT_SECONDS = 30
CANVAS_FILE_STREAM_CHUNK_SIZE = 64 * 1024


def normalize_canvas_base_url(raw_value: str) -> str:
    normalized = raw_value.strip().rstrip("/")
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise LmsProviderError("LMS_CONFIG_INVALID", "Canvas base_url must be a valid http or https URL.")
    if parsed.path.rstrip("/") == CANVAS_API_PREFIX:
        raise LmsProviderError("LMS_CONFIG_INVALID", "Canvas base_url must not include the /api/v1 suffix.")
    if parsed.query or parsed.fragment:
        raise LmsProviderError("LMS_CONFIG_INVALID", "Canvas base_url must not include query parameters or fragments.")
    if parsed.username or parsed.password:
        raise LmsProviderError("LMS_CONFIG_INVALID", "Canvas base_url must not include embedded credentials.")
    _validate_outbound_canvas_url(normalized)
    return normalized


def _default_port_for_scheme(scheme: str) -> int:
    return 443 if scheme == "https" else 80


def _origin_for_parsed_url(parsed) -> str:
    if not parsed.hostname:
        raise LmsProviderError("LMS_CONFIG_INVALID", "Canvas URL must include a hostname.")
    port = parsed.port
    default_port = _default_port_for_scheme(parsed.scheme)
    normalized_port = f":{port}" if port and port != default_port else ""
    return f"{parsed.scheme}://{parsed.hostname}{normalized_port}"


def _is_blocked_ip_address(address: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return (
        address.is_loopback
        or address.is_private
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    )


def _resolve_and_validate_hostname(hostname: str, port: int) -> None:
    lowered_hostname = hostname.lower()
    if lowered_hostname in {"localhost", "localhost.localdomain"}:
        raise LmsProviderError(
            "LMS_CONFIG_INVALID",
            "Canvas base_url must not target localhost or other loopback/private network hosts.",
        )

    addresses: set[ipaddress.IPv4Address | ipaddress.IPv6Address] = set()
    try:
        addresses.add(ipaddress.ip_address(lowered_hostname))
    except ValueError:
        try:
            records = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
        except OSError as exc:
            raise LmsProviderError("LMS_CONFIG_INVALID", "Canvas base_url host could not be resolved.") from exc
        for record in records:
            ip_text = record[4][0]
            addresses.add(ipaddress.ip_address(ip_text))

    if not addresses:
        raise LmsProviderError("LMS_CONFIG_INVALID", "Canvas base_url host could not be resolved.")
    if any(_is_blocked_ip_address(address) for address in addresses):
        raise LmsProviderError(
            "LMS_CONFIG_INVALID",
            "Canvas base_url must not resolve to loopback, private, or link-local network hosts.",
        )


def _validate_outbound_canvas_url(raw_value: str, *, expected_origin: Optional[str] = None) -> str:
    normalized = raw_value.strip()
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or not parsed.hostname:
        raise LmsProviderError("LMS_CONFIG_INVALID", "Canvas URL must be a valid http or https URL.")
    if parsed.username or parsed.password:
        raise LmsProviderError("LMS_CONFIG_INVALID", "Canvas URL must not include embedded credentials.")

    origin = _origin_for_parsed_url(parsed)
    if expected_origin is not None and origin != expected_origin:
        raise LmsProviderError(
            "LMS_PROVIDER_ERROR",
            "Canvas returned a cross-origin URL, which has been blocked.",
            status_code=502,
        )

    _resolve_and_validate_hostname(parsed.hostname, parsed.port or _default_port_for_scheme(parsed.scheme))
    return origin


class CanvasLmsProvider:
    provider = "canvas"

    def normalize_integration_config(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise LmsProviderError("LMS_CONFIG_INVALID", "config must be a JSON object.")
        return {"base_url": normalize_canvas_base_url(str(value.get("base_url") or ""))}

    def normalize_integration_credentials(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise LmsProviderError("LMS_CREDENTIALS_INVALID", "credentials must be a JSON object.")
        token = str(value.get("personal_access_token") or "").strip()
        if not token:
            raise LmsProviderError("LMS_CREDENTIALS_INVALID", "Canvas personal_access_token is required.")
        return {"personal_access_token": token}

    def mask_credentials(self, credentials: dict[str, Any]) -> Optional[str]:
        raw_value = str(credentials.get("personal_access_token") or "").strip()
        if not raw_value:
            return None
        visible_prefix = raw_value[:4]
        hidden_length = max(4, len(raw_value) - len(visible_prefix))
        return f"{visible_prefix}{'*' * hidden_length}"

    def _normalize_due_date(self, raw_value: Any) -> Optional[str]:
        if raw_value is None:
            return None
        normalized = str(raw_value).strip()
        if not normalized:
            return None
        try:
            parsed = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
        except ValueError:
            return None
        return parsed.date().isoformat()

    def _optional_int(self, raw_value: Any) -> Optional[int]:
        if raw_value is None:
            return None
        if isinstance(raw_value, bool):
            return None
        try:
            return int(raw_value)
        except (TypeError, ValueError):
            return None

    def _optional_float(self, raw_value: Any) -> Optional[float]:
        if raw_value is None:
            return None
        if isinstance(raw_value, bool):
            return None
        try:
            return float(raw_value)
        except (TypeError, ValueError):
            return None

    def _build_session(self, config: dict[str, Any], credentials: dict[str, Any]) -> tuple[str, requests.Session]:
        base_url = self.normalize_integration_config(config)["base_url"]
        token = self.normalize_integration_credentials(credentials)["personal_access_token"]

        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        })
        return base_url, session

    def _raise_for_redirect(self, response: requests.Response) -> None:
        if 300 <= response.status_code < 400:
            raise LmsProviderError(
                "LMS_PROVIDER_ERROR",
                "Canvas returned an unexpected redirect response.",
                status_code=502,
            )

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
        request_url = f"{base_url}{CANVAS_API_PREFIX}{path}"
        expected_origin = _validate_outbound_canvas_url(base_url)
        _validate_outbound_canvas_url(request_url, expected_origin=expected_origin)
        response = session.get(
            request_url,
            params=params,
            timeout=CANVAS_REQUEST_TIMEOUT_SECONDS,
            allow_redirects=False,
        )
        self._raise_for_redirect(response)
        response.raise_for_status()
        return response.json()

    def _request_stream(
        self,
        session: requests.Session,
        url: str,
        *,
        expected_origin: Optional[str] = None,
    ) -> requests.Response:
        _validate_outbound_canvas_url(url, expected_origin=expected_origin)
        response = session.get(
            url,
            timeout=CANVAS_REQUEST_TIMEOUT_SECONDS,
            allow_redirects=False,
            stream=True,
        )
        self._raise_for_redirect(response)
        response.raise_for_status()
        return response

    def _request_file_stream(
        self,
        session: requests.Session,
        base_url: str,
        raw_url: str,
    ) -> requests.Response:
        canvas_origin = _validate_outbound_canvas_url(base_url)
        next_url = urljoin(base_url, raw_url)

        for _ in range(5):
            next_origin = _validate_outbound_canvas_url(next_url)
            requester = session.get if next_origin == canvas_origin else requests.get
            response = requester(
                next_url,
                timeout=CANVAS_REQUEST_TIMEOUT_SECONDS,
                allow_redirects=False,
                stream=True,
            )

            if 300 <= response.status_code < 400:
                location = response.headers.get("Location")
                response.close()
                if not location:
                    raise LmsProviderError(
                        "LMS_PROVIDER_ERROR",
                        "Canvas returned an unexpected redirect response.",
                        status_code=502,
                    )
                next_url = urljoin(next_url, location)
                continue

            response.raise_for_status()
            return response

        raise LmsProviderError(
            "LMS_PROVIDER_ERROR",
            "Canvas returned too many redirects while downloading a file.",
            status_code=502,
        )

    def _paginate_json(
        self,
        session: requests.Session,
        base_url: str,
        path: str,
        *,
        params: Optional[dict[str, Any]] = None,
    ) -> list[dict[str, Any]]:
        next_url = f"{base_url}{CANVAS_API_PREFIX}{path}"
        expected_origin = _validate_outbound_canvas_url(base_url)
        next_params = dict(params or {})
        items: list[dict[str, Any]] = []

        while next_url:
            _validate_outbound_canvas_url(next_url, expected_origin=expected_origin)
            response = session.get(
                next_url,
                params=next_params,
                timeout=CANVAS_REQUEST_TIMEOUT_SECONDS,
                allow_redirects=False,
            )
            self._raise_for_redirect(response)
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

    def _normalize_page_summary(self, payload: dict[str, Any]) -> LmsPageSummaryData:
        return LmsPageSummaryData(
            page_id=str(payload.get("page_id") or payload.get("id") or ""),
            url=str(payload.get("url") or "").strip(),
            title=str(payload.get("title") or "").strip() or "Page",
            updated_at=payload.get("updated_at"),
            html_url=payload.get("html_url"),
            published=bool(payload.get("published")),
            front_page=bool(payload.get("front_page")),
        )

    def _normalize_page_detail(self, payload: dict[str, Any]) -> LmsPageDetailData:
        summary = self._normalize_page_summary(payload)
        return LmsPageDetailData(
            **summary.__dict__,
            body=payload.get("body"),
            locked_for_user=bool(payload.get("locked_for_user")),
            lock_explanation=payload.get("lock_explanation"),
            editing_roles=payload.get("editing_roles"),
        )

    def _normalize_navigation_tab(self, payload: dict[str, Any], *, active: bool = False) -> LmsCourseNavigationTabData:
        tab_id = str(payload.get("id") or "").strip()
        return LmsCourseNavigationTabData(
            tab_id=tab_id,
            label=str(payload.get("label") or tab_id or "Tab").strip() or "Tab",
            html_url=payload.get("html_url"),
            hidden=bool(payload.get("hidden")),
            position=self._optional_int(payload.get("position")) or 0,
            tab_type=str(payload.get("type") or "").strip() or None,
            active=active,
        )

    def _normalize_announcement(self, payload: dict[str, Any]) -> Optional[LmsAnnouncementSummaryData]:
        context_code = str(payload.get("context_code") or "").strip()
        if context_code and not context_code.startswith("course_"):
            return None
        return LmsAnnouncementSummaryData(
            announcement_id=str(payload.get("id") or ""),
            title=str(payload.get("title") or "").strip() or "Announcement",
            body=payload.get("message") or payload.get("body"),
            posted_at=payload.get("posted_at") or payload.get("created_at"),
            updated_at=payload.get("updated_at"),
            html_url=payload.get("html_url"),
        )

    def _normalize_module_item_type(self, raw_type: Optional[str]) -> tuple[Optional[str], bool]:
        normalized = str(raw_type or "").strip().lower().replace(" ", "_")
        if not normalized:
            return None, False

        normalized = {
            "sub_header": "subheader",
            "discussion_topic": "discussion",
            "discussiontopics": "discussion",
            "discussiontopic": "discussion",
            "externaltool": "external_tool",
            "externalurl": "external_url",
        }.get(normalized, normalized)

        in_app_supported = normalized in {"page", "assignment", "quiz", "file", "subheader"}
        return normalized, in_app_supported

    def _normalize_module_item(self, payload: dict[str, Any]) -> LmsModuleItemData:
        completion_requirement = payload.get("completion_requirement")
        requirement_type = None
        if isinstance(completion_requirement, dict):
            requirement_type = str(completion_requirement.get("type") or "").strip() or None
        item_id = str(payload.get("id") or "").strip()
        target_type, in_app_supported = self._normalize_module_item_type(payload.get("type"))
        content_details = payload.get("content_details")
        if not isinstance(content_details, dict):
            content_details = None
        page_url = str(payload.get("page_url") or "").strip() or None
        if page_url is None and isinstance(content_details, dict):
            page_url = str(content_details.get("page_url") or "").strip() or None
        external_url = str(payload.get("external_url") or "").strip() or None
        if external_url is None and isinstance(content_details, dict):
            external_url = str(content_details.get("external_url") or "").strip() or None
        return LmsModuleItemData(
            module_item_id=item_id,
            title=str(payload.get("title") or item_id or "Module Item").strip() or "Module Item",
            item_type=str(payload.get("type") or "").strip() or None,
            content_id=str(payload.get("content_id") or "").strip() or None,
            html_url=payload.get("html_url"),
            url=payload.get("url"),
            position=self._optional_int(payload.get("position")),
            indent=self._optional_int(payload.get("indent")),
            published=bool(payload.get("published")),
            completion_requirement_type=requirement_type,
            new_tab=bool(payload.get("new_tab")),
            target_type=target_type,
            page_url=page_url,
            external_url=external_url,
            content_details=content_details,
            in_app_supported=in_app_supported,
        )

    def _normalize_file(self, payload: dict[str, Any]) -> LmsCourseFileData:
        file_id = str(payload.get("id") or "").strip()
        filename = payload.get("filename")
        if filename is not None:
            filename = str(filename).strip() or None
        mime_type = payload.get("content-type") or payload.get("mime_type") or payload.get("content_type")
        if mime_type is not None:
            mime_type = str(mime_type).strip() or None
        size_bytes = self._optional_int(payload.get("size"))
        if size_bytes is None:
            size_bytes = self._optional_int(payload.get("size_bytes"))
        return LmsCourseFileData(
            file_id=file_id,
            display_name=str(payload.get("display_name") or payload.get("filename") or file_id or "File").strip() or "File",
            filename=filename,
            mime_type=mime_type,
            size_bytes=size_bytes,
            url=payload.get("url"),
            preview_url=payload.get("preview_url"),
            locked_for_user=bool(payload.get("locked_for_user")),
            lock_explanation=payload.get("lock_explanation"),
        )

    def _normalize_module(self, payload: dict[str, Any]) -> LmsModuleSummaryData:
        raw_items = payload.get("items")
        inline_item_count = len(raw_items) if isinstance(raw_items, list) else 0
        normalized_items: list[LmsModuleItemData] = []
        if isinstance(raw_items, list):
            for raw_item in raw_items:
                if isinstance(raw_item, dict):
                    normalized_items.append(self._normalize_module_item(raw_item))
        state = str(payload.get("workflow_state") or payload.get("state") or "").strip() or None
        module_id = str(payload.get("id") or "").strip()
        item_count = self._optional_int(payload.get("items_count"))
        return LmsModuleSummaryData(
            module_id=module_id,
            name=str(payload.get("name") or module_id or "Module").strip() or "Module",
            position=self._optional_int(payload.get("position")),
            published=bool(payload.get("published")),
            state=state,
            unlock_at=payload.get("unlock_at"),
            item_count=item_count if item_count is not None else inline_item_count,
            items=normalized_items,
        )

    def _normalize_quiz(self, payload: dict[str, Any]) -> LmsQuizSummaryData:
        quiz_id = str(payload.get("id") or "").strip()
        return LmsQuizSummaryData(
            quiz_id=quiz_id,
            title=str(payload.get("title") or quiz_id or "Quiz").strip() or "Quiz",
            description=payload.get("description"),
            due_at=payload.get("due_at"),
            unlock_at=payload.get("unlock_at"),
            lock_at=payload.get("lock_at"),
            html_url=payload.get("html_url"),
            published=bool(payload.get("published")),
        )

    def _active_navigation_tab_id(self, default_view: Optional[str]) -> Optional[str]:
        normalized = str(default_view or "").strip().lower()
        if not normalized or normalized in {"wiki", "feed"}:
            return "home"
        return normalized

    def _normalize_assignment(self, payload: dict[str, Any]) -> LmsAssignmentSummaryData:
        submission_types = payload.get("submission_types")
        due_at = payload.get("due_at")
        return LmsAssignmentSummaryData(
            external_id=str(payload.get("id") or ""),
            title=str(payload.get("name") or "").strip() or "Assignment",
            description=payload.get("description"),
            due_at=due_at,
            due_date=self._normalize_due_date(due_at),
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

    def _normalize_grade(self, payload: dict[str, Any]) -> Optional[LmsGradeSummaryData]:
        grades_payload = payload.get("grades")
        if not isinstance(grades_payload, dict):
            grades_payload = {}

        enrollment_type = str(payload.get("type") or "").strip() or None
        if enrollment_type != "StudentEnrollment":
            return None

        enrollment_id = str(payload.get("id") or "").strip()
        if not enrollment_id:
            return None

        return LmsGradeSummaryData(
            enrollment_id=enrollment_id,
            enrollment_type=enrollment_type,
            enrollment_role=str(payload.get("role") or "").strip() or None,
            enrollment_state=str(payload.get("enrollment_state") or "").strip() or None,
            html_url=payload.get("html_url"),
            grades_html_url=grades_payload.get("html_url") or payload.get("html_url"),
            current_grade=str(grades_payload.get("current_grade") or "").strip() or None,
            final_grade=str(grades_payload.get("final_grade") or "").strip() or None,
            current_score=self._optional_float(grades_payload.get("current_score")),
            final_score=self._optional_float(grades_payload.get("final_score")),
            current_points=self._optional_float(grades_payload.get("current_points")),
            unposted_current_grade=str(payload.get("unposted_current_grade") or "").strip() or None,
            unposted_final_grade=str(payload.get("unposted_final_grade") or "").strip() or None,
            unposted_current_score=self._optional_float(payload.get("unposted_current_score")),
            unposted_final_score=self._optional_float(payload.get("unposted_final_score")),
            has_grading_periods=bool(payload.get("has_grading_periods")),
            current_grading_period_title=str(payload.get("current_grading_period_title") or "").strip() or None,
            current_period_current_grade=str(payload.get("current_period_current_grade") or "").strip() or None,
            current_period_final_grade=str(payload.get("current_period_final_grade") or "").strip() or None,
            current_period_current_score=self._optional_float(payload.get("current_period_current_score")),
            current_period_final_score=self._optional_float(payload.get("current_period_final_score")),
        )

    def _normalize_calendar_event(self, payload: dict[str, Any]) -> Optional[LmsCalendarEventSummaryData]:
        context_code = str(payload.get("context_code") or "").strip()
        if not context_code.startswith("course_"):
            return None

        start_at = payload.get("start_at")
        if not start_at:
            return None
        end_at = payload.get("end_at") or start_at

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

    def get_course_navigation(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> LmsCourseNavigationData:
        try:
            base_url, session = self._build_session(config, credentials)
            course_payload = self._request_json(session, base_url, f"/courses/{external_course_id}")
            if not isinstance(course_payload, dict):
                raise LmsProviderError("LMS_PROVIDER_ERROR", "Canvas returned an unexpected provider payload.", status_code=502)

            default_view = course_payload.get("default_view")
            front_page_url: Optional[str] = None
            normalized_default_view = str(default_view or "").strip().lower()
            if normalized_default_view in {"", "wiki"}:
                try:
                    front_page_payload = self._request_json(session, base_url, f"/courses/{external_course_id}/front_page")
                except requests.HTTPError as exc:
                    response = exc.response
                    if response is not None and response.status_code == 404:
                        front_page_payload = None
                    else:
                        raise
                if isinstance(front_page_payload, dict):
                    front_page_url = front_page_payload.get("html_url") or front_page_payload.get("url")

            tab_payloads = self._paginate_json(
                session,
                base_url,
                f"/courses/{external_course_id}/tabs",
                params={"per_page": 100},
            )
            active_tab_id = self._active_navigation_tab_id(default_view)
            tabs: list[LmsCourseNavigationTabData] = []
            for item in tab_payloads:
                if not isinstance(item, dict):
                    continue
                tab = self._normalize_navigation_tab(item, active=str(item.get("id") or "").strip().lower() == active_tab_id)
                tabs.append(tab)

            return LmsCourseNavigationData(
                default_view=str(default_view or "").strip() or None,
                front_page_url=front_page_url,
                tabs=tabs,
            )
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

    def list_course_announcements(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> list[LmsAnnouncementSummaryData]:
        try:
            base_url, session = self._build_session(config, credentials)
            payload = self._paginate_json(
                session,
                base_url,
                "/announcements",
                params={
                    "per_page": 100,
                    "context_codes[]": [f"course_{external_course_id}"],
                },
            )
            items: list[LmsAnnouncementSummaryData] = []
            for item in payload:
                if not isinstance(item, dict):
                    continue
                normalized = self._normalize_announcement(item)
                if normalized is not None:
                    items.append(normalized)
            return items
        except Exception as exc:
            raise self._map_provider_exception(exc) from exc

    def list_grades(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> list[LmsGradeSummaryData]:
        try:
            base_url, session = self._build_session(config, credentials)
            payload = self._paginate_json(
                session,
                base_url,
                f"/courses/{external_course_id}/enrollments",
                params={
                    "user_id": "self",
                    "type[]": ["StudentEnrollment"],
                    "include[]": ["current_points"],
                    "per_page": 100,
                },
            )
            items: list[LmsGradeSummaryData] = []
            for item in payload:
                if not isinstance(item, dict):
                    continue
                normalized = self._normalize_grade(item)
                if normalized is not None:
                    items.append(normalized)
            return items
        except Exception as exc:
            raise self._map_provider_exception(exc) from exc

    def list_course_modules(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> list[LmsModuleSummaryData]:
        try:
            base_url, session = self._build_session(config, credentials)
            payload = self._paginate_json(
                session,
                base_url,
                f"/courses/{external_course_id}/modules",
                params={
                    "per_page": 100,
                    "include[]": ["items"],
                },
            )
            items: list[LmsModuleSummaryData] = []
            for item in payload:
                if isinstance(item, dict):
                    items.append(self._normalize_module(item))
            return items
        except Exception as exc:
            raise self._map_provider_exception(exc) from exc

    def list_course_module_items(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
        module_id: str,
    ) -> list[LmsModuleItemData]:
        try:
            base_url, session = self._build_session(config, credentials)
            payload = self._paginate_json(
                session,
                base_url,
                f"/courses/{external_course_id}/modules/{module_id}/items",
                params={
                    "per_page": 100,
                    "include[]": ["content_details"],
                },
            )
            items: list[LmsModuleItemData] = []
            for item in payload:
                if isinstance(item, dict):
                    items.append(self._normalize_module_item(item))
            return items
        except Exception as exc:
            raise self._map_provider_exception(exc) from exc

    def get_course_file(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
        file_id: str,
    ) -> LmsCourseFileData:
        try:
            base_url, session = self._build_session(config, credentials)
            payload = self._request_json(
                session,
                base_url,
                f"/courses/{external_course_id}/files/{file_id}",
            )
            if not isinstance(payload, dict):
                raise LmsProviderError("LMS_PROVIDER_ERROR", "Canvas returned an unexpected provider payload.", status_code=502)
            return self._normalize_file(payload)
        except Exception as exc:
            raise self._map_provider_exception(exc) from exc

    def open_course_file(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
        file_id: str,
    ) -> LmsCourseFileStreamData:
        try:
            base_url, session = self._build_session(config, credentials)
            payload = self._request_json(
                session,
                base_url,
                f"/courses/{external_course_id}/files/{file_id}",
            )
            if not isinstance(payload, dict):
                raise LmsProviderError("LMS_PROVIDER_ERROR", "Canvas returned an unexpected provider payload.", status_code=502)
            file_data = self._normalize_file(payload)
            download_url = str(file_data.url or file_data.preview_url or "").strip()
            if not download_url:
                raise LmsProviderError("LMS_PROVIDER_ERROR", "Canvas returned an unexpected provider payload.", status_code=502)
            response = self._request_file_stream(session, base_url, download_url)

            def _iter_content() -> Iterator[bytes]:
                try:
                    for chunk in response.iter_content(chunk_size=CANVAS_FILE_STREAM_CHUNK_SIZE):
                        if chunk:
                            yield chunk
                finally:
                    response.close()

            return LmsCourseFileStreamData(
                **file_data.__dict__,
                content=_iter_content(),
            )
        except Exception as exc:
            raise self._map_provider_exception(exc) from exc

    def list_course_pages(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> list[LmsPageSummaryData]:
        try:
            base_url, session = self._build_session(config, credentials)
            payload = self._paginate_json(
                session,
                base_url,
                f"/courses/{external_course_id}/pages",
                params={"per_page": 100, "sort": "title", "order": "asc"},
            )
            return [self._normalize_page_summary(item) for item in payload]
        except Exception as exc:
            raise self._map_provider_exception(exc) from exc

    def list_course_quizzes(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> list[LmsQuizSummaryData]:
        try:
            base_url, session = self._build_session(config, credentials)
            payload = self._paginate_json(
                session,
                base_url,
                f"/courses/{external_course_id}/quizzes",
                params={"per_page": 100},
            )
            return [self._normalize_quiz(item) for item in payload]
        except Exception as exc:
            raise self._map_provider_exception(exc) from exc

    def get_course_syllabus(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> LmsCourseSyllabusData:
        try:
            base_url, session = self._build_session(config, credentials)
            payload = self._request_json(
                session,
                base_url,
                f"/courses/{external_course_id}",
                params={"include[]": ["syllabus_body"]},
            )
            if not isinstance(payload, dict):
                raise LmsProviderError("LMS_PROVIDER_ERROR", "Canvas returned an unexpected provider payload.", status_code=502)
            return LmsCourseSyllabusData(
                body=payload.get("syllabus_body"),
                html_url=f"{base_url}/courses/{external_course_id}/assignments/syllabus",
            )
        except Exception as exc:
            raise self._map_provider_exception(exc) from exc

    def get_course_page(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
        page_ref: str,
    ) -> LmsPageDetailData:
        try:
            base_url, session = self._build_session(config, credentials)
            payload = self._request_json(
                session,
                base_url,
                f"/courses/{external_course_id}/pages/{page_ref}",
            )
            if not isinstance(payload, dict):
                raise LmsProviderError("LMS_PROVIDER_ERROR", "Canvas returned an unexpected provider payload.", status_code=502)
            return self._normalize_page_detail(payload)
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
