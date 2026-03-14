# input:  [Dataclasses, typing protocol helpers, and provider adapter implementations]
# output: [Provider-neutral LMS DTOs, error types, and provider registry resolution helpers]
# pos:    [Contract layer between LMS service orchestration and provider-specific adapters]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from dataclasses import dataclass
from typing import Any, Optional, Protocol


@dataclass
class LmsConnectionSummaryData:
    external_user_id: str
    display_name: Optional[str] = None
    login_id: Optional[str] = None
    email: Optional[str] = None


@dataclass
class LmsCourseSummaryData:
    external_id: str
    name: str
    course_code: Optional[str]
    workflow_state: Optional[str]
    start_at: Optional[str]
    end_at: Optional[str]


@dataclass
class LmsCoursePageData:
    items: list[LmsCourseSummaryData]
    page: int
    page_size: int
    has_more: bool
    next_page: Optional[int]


class LmsProviderError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 422) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class LmsProvider(Protocol):
    provider: str

    def validate_connection(self, config: dict[str, Any], credentials: dict[str, Any]) -> LmsConnectionSummaryData:
        ...

    def get_connection_summary(self, config: dict[str, Any], credentials: dict[str, Any]) -> LmsConnectionSummaryData:
        ...

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
        ...


def get_lms_provider(provider: str) -> LmsProvider:
    normalized = provider.strip().lower()
    from lms_canvas import CanvasLmsProvider

    registry: dict[str, LmsProvider] = {
        "canvas": CanvasLmsProvider(),
    }
    resolved = registry.get(normalized)
    if resolved is None:
        raise LmsProviderError("LMS_PROVIDER_NOT_SUPPORTED", f"Provider '{provider}' is not supported.", status_code=404)
    return resolved
