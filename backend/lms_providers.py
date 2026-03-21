# input:  [Dataclasses, typing protocol helpers, and provider adapter implementations]
# output: [Provider-neutral LMS DTOs, provider adapter protocol methods for integration payload normalization and credential masking, error types, and provider registry resolution helpers]
# pos:    [Contract layer between LMS service orchestration and provider-specific adapters for integration setup, course links, navigation, announcements, modules, pages, quizzes, syllabus, and calendar reads]
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


@dataclass
class LmsPageSummaryData:
    page_id: str
    url: str
    title: str
    updated_at: Optional[str]
    html_url: Optional[str]
    published: bool
    front_page: bool


@dataclass
class LmsPageDetailData(LmsPageSummaryData):
    body: Optional[str]
    locked_for_user: bool
    lock_explanation: Optional[str]
    editing_roles: Optional[str]


@dataclass
class LmsCourseNavigationTabData:
    tab_id: str
    label: str
    html_url: Optional[str]
    hidden: bool
    position: int
    tab_type: Optional[str]
    active: bool


@dataclass
class LmsCourseNavigationData:
    default_view: Optional[str]
    front_page_url: Optional[str]
    tabs: list[LmsCourseNavigationTabData]


@dataclass
class LmsAnnouncementSummaryData:
    announcement_id: str
    title: str
    body: Optional[str]
    posted_at: Optional[str]
    updated_at: Optional[str]
    html_url: Optional[str]


@dataclass
class LmsModuleItemData:
    module_item_id: str
    title: str
    item_type: Optional[str]
    content_id: Optional[str]
    html_url: Optional[str]
    url: Optional[str]
    position: Optional[int]
    indent: Optional[int]
    published: bool
    completion_requirement_type: Optional[str]
    new_tab: bool


@dataclass
class LmsModuleSummaryData:
    module_id: str
    name: str
    position: Optional[int]
    published: bool
    state: Optional[str]
    unlock_at: Optional[str]
    items: list[LmsModuleItemData]


@dataclass
class LmsQuizSummaryData:
    quiz_id: str
    title: str
    description: Optional[str]
    due_at: Optional[str]
    unlock_at: Optional[str]
    lock_at: Optional[str]
    html_url: Optional[str]
    published: bool


@dataclass
class LmsCourseSyllabusData:
    body: Optional[str]
    html_url: Optional[str]


@dataclass
class LmsAssignmentSummaryData:
    external_id: str
    title: str
    description: Optional[str]
    due_at: Optional[str]
    due_date: Optional[str]
    unlock_at: Optional[str]
    lock_at: Optional[str]
    html_url: Optional[str]
    published: bool
    submission_types: list[str]


@dataclass
class LmsCalendarEventSummaryData:
    external_id: str
    external_course_id: str
    title: str
    description: Optional[str]
    location: Optional[str]
    start_at: str
    end_at: str
    all_day: bool
    html_url: Optional[str]
    event_type_code: str


class LmsProviderError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 422) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class LmsProvider(Protocol):
    provider: str

    def normalize_integration_config(self, value: Any) -> dict[str, Any]:
        ...

    def normalize_integration_credentials(self, value: Any) -> dict[str, Any]:
        ...

    def mask_credentials(self, credentials: dict[str, Any]) -> Optional[str]:
        ...

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

    def get_course(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> LmsCourseSummaryData:
        ...

    def list_assignments(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> list[LmsAssignmentSummaryData]:
        ...

    def list_course_pages(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> list[LmsPageSummaryData]:
        ...

    def get_course_page(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
        page_ref: str,
    ) -> LmsPageDetailData:
        ...

    def get_course_navigation(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> LmsCourseNavigationData:
        ...

    def list_course_announcements(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> list[LmsAnnouncementSummaryData]:
        ...

    def list_course_modules(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> list[LmsModuleSummaryData]:
        ...

    def list_course_quizzes(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> list[LmsQuizSummaryData]:
        ...

    def get_course_syllabus(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        external_course_id: str,
    ) -> LmsCourseSyllabusData:
        ...

    def list_calendar_events(
        self,
        config: dict[str, Any],
        credentials: dict[str, Any],
        *,
        context_codes: list[str],
        start_at: Optional[str],
        end_at: Optional[str],
    ) -> list[LmsCalendarEventSummaryData]:
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
