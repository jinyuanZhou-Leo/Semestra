# input:  [Pydantic BaseModel/Field validators, json/math helpers, typing/date enums, URL parsing helpers, and LMS provider registry helpers]
# output: [Request/response schema classes for API contracts, including Program subject-color settings, Program-level plugin governance payloads, manifest-backed plugin-system setup payloads, Semester draft lifecycle plus review payloads with typed draft-step validation, Semester activation payloads, unassigned-Course plugin activation payloads, provider-neutral LMS integration payloads with normalized due dates, course navigation/announcement/module/assignment/page/quiz/syllabus/file payloads, comprehensive backup import/export contracts, range-based schedule payloads, plugin-shared settings payloads, user setting update fields, semester todo domain payloads, fact-oriented course gradebooks with optional point-based score fields, and normalized Canvas module-item target metadata]
# pos:    [Serialization and validation layer between API and domain services, including Program visual settings, plugin governance and plugin-system setup contracts plus validated Semester draft review state and step values, unassigned-Course plugin activation contracts, LMS connection wire payloads, backup restore payloads across LMS/resources/schedule/todo data, range-scoped calendar and navigation/page/quiz/syllabus/file payloads, user preferences, plus todo and fact-only gradebook wire contracts with optional points-to-percentage assessment input and normalized module-item typing]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import json
import math
from urllib.parse import urlparse
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import List, Optional, Any, Literal
from enum import Enum
from datetime import date

from lms_providers import get_lms_provider

def _validate_single_widget_layout(value: Any, scope: str) -> None:
    if not isinstance(value, dict):
        raise ValueError(f'{scope} must be a JSON object.')

    required_fields = ("x", "y", "w", "h")
    missing_fields = [field for field in required_fields if field not in value]
    if missing_fields:
        raise ValueError(f'{scope} must include x, y, w, h.')

    unknown_fields = [field for field in value.keys() if field not in required_fields]
    if unknown_fields:
        raise ValueError(f'{scope} contains unsupported fields: {", ".join(sorted(unknown_fields))}.')

    for field in required_fields:
        field_value = value[field]
        if isinstance(field_value, bool) or not isinstance(field_value, (int, float)):
            raise ValueError(f'{scope}.{field} must be a number.')
        if not math.isfinite(float(field_value)):
            raise ValueError(f'{scope}.{field} must be finite.')

    if value["x"] < 0 or value["y"] < 0:
        raise ValueError(f'{scope}.x and {scope}.y must be >= 0.')
    if value["w"] < 1 or value["h"] < 1:
        raise ValueError(f'{scope}.w and {scope}.h must be >= 1.')

def _validate_widget_layout_config(value: str) -> str:
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as error:
        raise ValueError('layout_config must be valid JSON.') from error

    if not isinstance(parsed, dict):
        raise ValueError('layout_config must be a JSON object.')

    if parsed == {}:
        return value

    has_single_layout = all(key in parsed for key in ("x", "y", "w", "h"))
    has_responsive_layout = "desktop" in parsed or "mobile" in parsed

    if has_single_layout and has_responsive_layout:
        raise ValueError('layout_config cannot mix flat layout fields with responsive fields.')

    if has_single_layout:
        _validate_single_widget_layout(parsed, "layout_config")
        return value

    if has_responsive_layout:
        unknown_fields = [field for field in parsed.keys() if field not in ("desktop", "mobile")]
        if unknown_fields:
            raise ValueError(f'layout_config contains unsupported fields: {", ".join(sorted(unknown_fields))}.')

        desktop_layout = parsed.get("desktop")
        mobile_layout = parsed.get("mobile")
        if desktop_layout is None and mobile_layout is None:
            raise ValueError('layout_config must include at least one of desktop or mobile.')

        if desktop_layout is not None:
            _validate_single_widget_layout(desktop_layout, "layout_config.desktop")
        if mobile_layout is not None:
            _validate_single_widget_layout(mobile_layout, "layout_config.mobile")
        return value

    raise ValueError('layout_config must be empty, flat {x,y,w,h}, or responsive {desktop,mobile}.')

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    password: str

    @field_validator('password')
    def validate_password(cls, value: str) -> str:
        if len(value) <= 8:
            raise ValueError('Password must be longer than 8 characters.')
        has_lowercase = any(char.islower() for char in value)
        has_uppercase = any(char.isupper() for char in value)
        if not has_lowercase or not has_uppercase:
            raise ValueError('Password must include both uppercase and lowercase letters.')
        return value

class User(UserBase):
    id: str
    nickname: Optional[str] = None
    is_active: bool = True
    user_setting: Optional[str] = None
    google_sub: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    nickname: Optional[str] = None
    user_setting: Optional[str] = None
    # Backward-compatible fields that are merged into user_setting.
    gpa_scaling_table: Optional[str] = None
    default_course_credit: Optional[float] = None
    background_plugin_preload: Optional[bool] = None

class GoogleAuthRequest(BaseModel):
    id_token: str


def _validate_lms_provider(value: str) -> str:
    normalized = value.strip().lower()
    try:
        get_lms_provider(normalized)
    except Exception as exc:
        raise ValueError(str(exc)) from exc
    return normalized


def _validate_lms_json_object(field_name: str, value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{field_name} must be a JSON object.")
    return value


class LmsIntegrationError(BaseModel):
    code: str
    message: str


class LmsConnectionSummary(BaseModel):
    external_user_id: str
    display_name: Optional[str] = None
    login_id: Optional[str] = None
    email: Optional[str] = None


class LmsIntegrationSummary(BaseModel):
    id: str
    display_name: str
    provider: str

    model_config = ConfigDict(from_attributes=True)


class LmsIntegrationCreateRequest(BaseModel):
    provider: str
    display_name: str
    config: dict[str, Any]
    credentials: dict[str, Any]

    @field_validator("provider")
    def validate_provider(cls, value: str) -> str:
        return _validate_lms_provider(value)

    @field_validator("display_name")
    def validate_display_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("display_name is required.")
        return normalized

    @field_validator("config")
    def validate_config(cls, value: Any) -> dict[str, Any]:
        return _validate_lms_json_object("config", value)

    @field_validator("credentials")
    def validate_credentials(cls, value: Any) -> dict[str, Any]:
        return _validate_lms_json_object("credentials", value)


class LmsIntegrationUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    config: Optional[dict[str, Any]] = None
    credentials: Optional[dict[str, Any]] = None

    @field_validator("display_name")
    def validate_optional_display_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("display_name cannot be empty.")
        return normalized

    @field_validator("config")
    def validate_optional_config(cls, value: Optional[Any]) -> Optional[dict[str, Any]]:
        if value is None:
            return value
        return _validate_lms_json_object("config", value)

    @field_validator("credentials")
    def validate_optional_credentials(cls, value: Optional[Any]) -> Optional[dict[str, Any]]:
        if value is None:
            return value
        return _validate_lms_json_object("credentials", value)

    @model_validator(mode="after")
    def validate_update_pair(self) -> "LmsIntegrationUpdateRequest":
        if self.display_name is None and self.config is None and self.credentials is None:
            raise ValueError("At least one field must be provided.")
        return self


class LmsIntegrationValidationRequest(BaseModel):
    provider: str
    config: dict[str, Any]
    credentials: dict[str, Any]

    @field_validator("provider")
    def validate_provider(cls, value: str) -> str:
        return _validate_lms_provider(value)

    @field_validator("config")
    def validate_config(cls, value: Any) -> dict[str, Any]:
        return _validate_lms_json_object("config", value)

    @field_validator("credentials")
    def validate_credentials(cls, value: Any) -> dict[str, Any]:
        return _validate_lms_json_object("credentials", value)


class LmsIntegrationResponse(BaseModel):
    id: str
    display_name: str
    provider: str
    status: str
    config: dict[str, Any]
    masked_api_key: Optional[str] = None
    last_checked_at: Optional[str] = None
    last_error: Optional[LmsIntegrationError] = None
    summary: Optional[LmsConnectionSummary] = None


class LmsIntegrationValidationResponse(BaseModel):
    provider: str
    status: str
    last_checked_at: Optional[str] = None
    last_error: Optional[LmsIntegrationError] = None
    summary: Optional[LmsConnectionSummary] = None


class LmsCourseSummary(BaseModel):
    external_id: str
    name: str
    course_code: Optional[str] = None
    workflow_state: Optional[str] = None
    start_at: Optional[str] = None
    end_at: Optional[str] = None


class LmsCourseListResponse(BaseModel):
    integration_id: str
    items: List[LmsCourseSummary] = []
    page: int = 1
    page_size: int = 50
    has_more: bool = False
    next_page: Optional[int] = None


class LmsPageSummary(BaseModel):
    page_id: str
    url: str
    title: str
    updated_at: Optional[str] = None
    html_url: Optional[str] = None
    published: bool = False
    front_page: bool = False


class LmsPageListResponse(BaseModel):
    items: List[LmsPageSummary] = []


class LmsPageDetail(LmsPageSummary):
    body: Optional[str] = None
    locked_for_user: bool = False
    lock_explanation: Optional[str] = None
    editing_roles: Optional[str] = None


class LmsCourseNavigationTab(BaseModel):
    tab_id: str
    label: str
    html_url: Optional[str] = None
    hidden: bool = False
    position: int = 0
    tab_type: Optional[str] = None
    active: bool = False


class LmsCourseNavigationResponse(BaseModel):
    default_view: Optional[str] = None
    front_page_url: Optional[str] = None
    tabs: List[LmsCourseNavigationTab] = []


class LmsAnnouncementSummary(BaseModel):
    announcement_id: str
    title: str
    body: Optional[str] = None
    posted_at: Optional[str] = None
    updated_at: Optional[str] = None
    html_url: Optional[str] = None


class LmsAnnouncementListResponse(BaseModel):
    items: List[LmsAnnouncementSummary] = []


class LmsModuleItem(BaseModel):
    module_item_id: str
    title: str
    item_type: Optional[str] = None
    content_id: Optional[str] = None
    html_url: Optional[str] = None
    url: Optional[str] = None
    position: Optional[int] = None
    indent: Optional[int] = None
    published: bool = False
    completion_requirement_type: Optional[str] = None
    new_tab: bool = False
    target_type: Optional[str] = None
    page_url: Optional[str] = None
    external_url: Optional[str] = None
    content_details: Optional[dict[str, Any]] = None
    in_app_supported: bool = False


class LmsModuleFile(BaseModel):
    file_id: str
    display_name: str
    filename: Optional[str] = None
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = None
    download_url: Optional[str] = None
    locked_for_user: bool = False
    lock_explanation: Optional[str] = None


class LmsModuleSummary(BaseModel):
    module_id: str
    name: str
    position: Optional[int] = None
    published: bool = False
    state: Optional[str] = None
    unlock_at: Optional[str] = None
    item_count: int = 0
    items: List[LmsModuleItem] = []


class LmsModuleListResponse(BaseModel):
    items: List[LmsModuleSummary] = []


class LmsModuleItemListResponse(BaseModel):
    items: List[LmsModuleItem] = []


class LmsQuizSummary(BaseModel):
    quiz_id: str
    title: str
    description: Optional[str] = None
    due_at: Optional[str] = None
    unlock_at: Optional[str] = None
    lock_at: Optional[str] = None
    html_url: Optional[str] = None
    published: bool = False


class LmsQuizListResponse(BaseModel):
    items: List[LmsQuizSummary] = []


class LmsCourseSyllabusResponse(BaseModel):
    body: Optional[str] = None
    html_url: Optional[str] = None


class LmsCourseLinkSummary(BaseModel):
    id: str
    lms_integration_id: str
    integration_display_name: str
    provider: str
    external_course_id: str
    external_course_code: Optional[str] = None
    external_name: Optional[str] = None
    sync_enabled: bool = True
    last_synced_at: Optional[str] = None
    last_error: Optional[LmsIntegrationError] = None
    model_config = ConfigDict(from_attributes=True)


class LmsCourseLinkUpdateRequest(BaseModel):
    external_course_id: str
    sync_enabled: bool = True

    @field_validator("external_course_id")
    def validate_external_course_id(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("external_course_id is required.")
        return normalized


class LmsCourseLinkSyncRequest(BaseModel):
    sync_enabled: Optional[bool] = None


class LmsCourseImportRequest(BaseModel):
    external_course_ids: List[str]
    semester_id: Optional[str] = None

    @field_validator("external_course_ids")
    def validate_external_course_ids(cls, value: List[str]) -> List[str]:
        normalized = [item.strip() for item in value if item and item.strip()]
        if not normalized:
            raise ValueError("external_course_ids must include at least one course id.")
        return normalized


class LmsCourseImportResult(BaseModel):
    external_course_id: str
    status: Literal["created", "skipped", "conflict"]
    course: Optional["Course"] = None
    error: Optional[LmsIntegrationError] = None


class LmsCourseImportResponse(BaseModel):
    integration_id: str
    results: List[LmsCourseImportResult] = []


class LmsSemesterImportRequest(BaseModel):
    name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    reading_week_start: Optional[date] = None
    reading_week_end: Optional[date] = None
    external_course_ids: List[str]

    @field_validator("name")
    def validate_semester_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("name is required.")
        return normalized

    @field_validator("external_course_ids")
    def validate_semester_external_course_ids(cls, value: List[str]) -> List[str]:
        normalized = [item.strip() for item in value if item and item.strip()]
        if not normalized:
            raise ValueError("external_course_ids must include at least one course id.")
        return normalized


class LmsAssignmentSummary(BaseModel):
    external_id: str
    course_id: str
    course_name: str
    course_display_code: str
    title: str
    description: Optional[str] = None
    due_at: Optional[str] = None
    due_date: Optional[date] = None
    unlock_at: Optional[str] = None
    lock_at: Optional[str] = None
    html_url: Optional[str] = None
    published: bool = False
    submission_types: List[str] = []


class LmsAssignmentListResponse(BaseModel):
    items: List[LmsAssignmentSummary] = []


class LmsGradeSummary(BaseModel):
    enrollment_id: str
    course_id: str
    course_name: str
    course_display_code: str
    enrollment_type: Optional[str] = None
    enrollment_role: Optional[str] = None
    enrollment_state: Optional[str] = None
    html_url: Optional[str] = None
    grades_html_url: Optional[str] = None
    current_grade: Optional[str] = None
    final_grade: Optional[str] = None
    current_score: Optional[float] = None
    final_score: Optional[float] = None
    current_points: Optional[float] = None
    unposted_current_grade: Optional[str] = None
    unposted_final_grade: Optional[str] = None
    unposted_current_score: Optional[float] = None
    unposted_final_score: Optional[float] = None
    has_grading_periods: bool = False
    current_grading_period_title: Optional[str] = None
    current_period_current_grade: Optional[str] = None
    current_period_final_grade: Optional[str] = None
    current_period_current_score: Optional[float] = None
    current_period_final_score: Optional[float] = None


class LmsGradeListResponse(BaseModel):
    items: List[LmsGradeSummary] = []


class LmsCalendarEventSummary(BaseModel):
    external_id: str
    source_id: str
    course_id: str
    course_name: str
    course_display_code: str
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    start_at: str
    end_at: str
    all_day: bool = False
    html_url: Optional[str] = None
    event_type_code: str = "LMS"


class LmsCalendarEventListResponse(BaseModel):
    items: List[LmsCalendarEventSummary] = []


class LmsSemesterImportResponse(BaseModel):
    semester: "Semester"
    courses: LmsCourseImportResponse

# --- Widget Schemas ---
class WidgetBase(BaseModel):
    widget_type: str
    title: str = ""
    layout_config: str = "{}"
    settings: str = "{}"
    is_removable: bool = True

    @field_validator('layout_config')
    def validate_layout_config(cls, value: str) -> str:
        return _validate_widget_layout_config(value)

class WidgetCreate(WidgetBase):
    pass

class Widget(WidgetBase):
    id: str
    semester_id: Optional[str] = None
    course_id: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class WidgetUpdate(BaseModel):
    widget_type: Optional[str] = None
    title: Optional[str] = None
    layout_config: Optional[str] = None
    settings: Optional[str] = None

    @field_validator('layout_config')
    def validate_layout_config(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return _validate_widget_layout_config(value)

# --- Tab Schemas ---
class TabBase(BaseModel):
    tab_type: str
    settings: str = "{}"
    order_index: int = 0
    is_removable: bool = True
    is_draggable: bool = True

class TabCreate(TabBase):
    order_index: Optional[int] = None

class Tab(TabBase):
    id: str
    semester_id: Optional[str] = None
    course_id: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class TabUpdate(BaseModel):
    settings: Optional[str] = None
    order_index: Optional[int] = None
    is_draggable: Optional[bool] = None

# --- Plugin Settings Schemas ---
class PluginSettingBase(BaseModel):
    plugin_id: str
    settings: str = "{}"

class PluginSettingCreate(PluginSettingBase):
    pass

class PluginSetting(PluginSettingBase):
    id: str
    semester_id: Optional[str] = None
    course_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class CourseResourceFile(BaseModel):
    id: str
    course_id: str
    filename_original: str
    filename_display: str
    resource_kind: str
    external_url: Optional[str] = None
    mime_type: str
    size_bytes: int
    storage_path: str
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)

class CourseResourceRenameRequest(BaseModel):
    filename_display: str

    @field_validator("filename_display")
    def validate_filename_display(cls, value: str) -> str:
        normalized = " ".join(value.split()).strip()
        if not normalized:
            raise ValueError("filename_display is required.")
        return normalized

class CourseResourceLinkCreate(BaseModel):
    url: str
    filename_display: Optional[str] = None

    @field_validator("url")
    def validate_url(cls, value: str) -> str:
        normalized = value.strip()
        parsed = urlparse(normalized)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("url must be a valid http or https URL.")
        return normalized

    @field_validator("filename_display")
    def validate_optional_filename_display(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = " ".join(value.split()).strip()
        return normalized or None

class CourseResourceUploadFailure(BaseModel):
    filename: str
    code: str
    message: str

class CourseResourceListResponse(BaseModel):
    files: List[CourseResourceFile] = []
    total_bytes_used: int = 0
    total_bytes_limit: int = 0
    remaining_bytes: int = 0

class CourseResourceUploadResponse(BaseModel):
    uploaded_files: List[CourseResourceFile] = []
    failed_files: List[CourseResourceUploadFailure] = []
    total_bytes_used: int = 0
    total_bytes_limit: int = 0
    remaining_bytes: int = 0

class TodoPriority(str, Enum):
    NONE = ""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"

class TodoSectionBase(BaseModel):
    name: str

    @field_validator("name")
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Section name is required.")
        return normalized

class TodoSectionCreate(TodoSectionBase):
    pass

class TodoSectionUpdate(BaseModel):
    name: Optional[str] = None

    @field_validator("name")
    def validate_optional_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("Section name is required.")
        return normalized

class TodoSection(TodoSectionBase):
    id: str
    semester_id: str
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)

class TodoTaskBase(BaseModel):
    title: str
    note: str = ""
    due_date: Optional[date] = None
    due_time: Optional[str] = None
    priority: TodoPriority = TodoPriority.NONE
    completed: bool = False
    course_id: Optional[str] = None
    section_id: Optional[str] = None
    origin_section_id: Optional[str] = None
    @field_validator("title")
    def validate_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Task title is required.")
        return normalized

    @field_validator("due_time")
    def validate_due_time(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return None
        if len(value) != 5:
            raise ValueError("due_time must use HH:MM format.")
        hour, minute = value.split(":", 1)
        if not hour.isdigit() or not minute.isdigit():
            raise ValueError("due_time must use HH:MM format.")
        if int(hour) < 0 or int(hour) > 23 or int(minute) < 0 or int(minute) > 59:
            raise ValueError("due_time must use HH:MM format.")
        return value

class TodoTaskCreate(TodoTaskBase):
    pass

class TodoTaskUpdate(BaseModel):
    title: Optional[str] = None
    note: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[str] = None
    priority: Optional[TodoPriority] = None
    completed: Optional[bool] = None
    course_id: Optional[str] = None
    section_id: Optional[str] = None
    origin_section_id: Optional[str] = None

    @field_validator("title")
    def validate_optional_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("Task title is required.")
        return normalized

    @field_validator("due_time")
    def validate_optional_due_time(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return None
        if len(value) != 5:
            raise ValueError("due_time must use HH:MM format.")
        hour, minute = value.split(":", 1)
        if not hour.isdigit() or not minute.isdigit():
            raise ValueError("due_time must use HH:MM format.")
        if int(hour) < 0 or int(hour) > 23 or int(minute) < 0 or int(minute) > 59:
            raise ValueError("due_time must use HH:MM format.")
        return value

class TodoTask(BaseModel):
    id: str
    semester_id: str
    title: str
    note: str
    due_date: Optional[date] = None
    due_time: Optional[str] = None
    priority: TodoPriority = TodoPriority.NONE
    completed: bool = False
    course_id: Optional[str] = None
    course_name: str = ""
    course_category: str = ""
    course_color: Optional[str] = None
    section_id: Optional[str] = None
    origin_section_id: Optional[str] = None
    created_at: str
    updated_at: str

class TodoCourseOption(BaseModel):
    id: str
    name: str
    category: str = ""
    color: Optional[str] = None

class TodoSemesterState(BaseModel):
    semester_id: str
    sections: List[TodoSection]
    tasks: List[TodoTask]
    course_options: List[TodoCourseOption] = []

# --- Course Schemas ---
class CourseBase(BaseModel):
    name: str
    alias: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = None
    credits: float = 0.0
    grade_percentage: float = 0.0
    grade_scaled: float = 0.0
    include_in_gpa: bool = True
    hide_gpa: bool = False

class CourseCreate(CourseBase):
    pass

class CourseUpdate(BaseModel):
    name: Optional[str] = None
    alias: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = None
    credits: Optional[float] = None
    grade_percentage: Optional[float] = None
    grade_scaled: Optional[float] = None
    include_in_gpa: Optional[bool] = None
    hide_gpa: Optional[bool] = None
    semester_id: Optional[str] = None

class Course(CourseBase):
    id: str
    program_id: str
    semester_id: Optional[str] = None
    has_gradebook: bool = False
    gradebook_revision: int = 0
    has_lms_link: bool = False
    lms_link: Optional[LmsCourseLinkSummary] = None
    model_config = ConfigDict(from_attributes=True)

class CourseWithWidgets(Course):
    widgets: List[Widget] = []
    tabs: List[Tab] = []
    plugin_settings: List[PluginSetting] = []
    plugin_activations: List["CoursePluginActivation"] = []
    enabled_plugin_ids: List[str] = []
    runtime_plugins: List[dict[str, Any]] = []
    available_widget_types: List[str] = []
    resolved_plugin_settings: List[PluginSetting] = []

class GradebookForecastModel(str, Enum):
    AUTO = "auto"
    SIMPLE_MINIMUM_NEEDED = "simple_minimum_needed"

class GradebookAssessmentCategoryBase(BaseModel):
    name: str
    key: str
    is_builtin: bool = False
    color_token: str = "slate"
    order_index: int = 0
    is_archived: bool = False

class GradebookAssessmentCategory(GradebookAssessmentCategoryBase):
    id: str

    model_config = ConfigDict(from_attributes=True)

class GradebookAssessmentBase(BaseModel):
    category_id: Optional[str] = None
    title: str
    due_date: Optional[date] = None
    weight: float = 0.0
    score: Optional[float] = None
    points_earned: Optional[float] = None
    points_possible: Optional[float] = None
    order_index: int = 0

class GradebookAssessment(GradebookAssessmentBase):
    id: str

    model_config = ConfigDict(from_attributes=True)

class CourseGradebook(BaseModel):
    course_id: str
    target_gpa: float
    forecast_model: GradebookForecastModel = GradebookForecastModel.AUTO
    scaling_table: dict[str, float] = {}
    categories: List[GradebookAssessmentCategory] = []
    assessments: List[GradebookAssessment] = []

class GradebookPreferencesUpdate(BaseModel):
    target_gpa: Optional[float] = None
    forecast_model: Optional[GradebookForecastModel] = None

class GradebookCategoryCreate(BaseModel):
    name: str
    color_token: Optional[str] = None

class GradebookCategoryUpdate(BaseModel):
    name: Optional[str] = None
    color_token: Optional[str] = None
    is_archived: Optional[bool] = None

class GradebookAssessmentCreate(GradebookAssessmentBase):
    pass

class GradebookAssessmentUpdate(BaseModel):
    category_id: Optional[str] = None
    title: Optional[str] = None
    due_date: Optional[date] = None
    weight: Optional[float] = None
    score: Optional[float] = None
    points_earned: Optional[float] = None
    points_possible: Optional[float] = None

class GradebookAssessmentReorderRequest(BaseModel):
    assessment_ids: List[str]


# --- Semester Schemas ---
SemesterLifecycleState = Literal["draft", "active", "abandoned"]
SemesterDraftStep = Literal["basics", "courses", "plugins", "plugin-setup", "review"]


class SemesterBase(BaseModel):
    name: str
    average_percentage: float = 0.0
    average_scaled: float = 0.0
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    reading_week_start: Optional[date] = None
    reading_week_end: Optional[date] = None

class SemesterCreate(SemesterBase):
    pass

class Semester(SemesterBase):
    id: str
    program_id: str
    lifecycle_state: SemesterLifecycleState = "active"
    creation_step: SemesterDraftStep = "review"
    draft_updated_at: Optional[str] = None
    review_ready: bool = False
    model_config = ConfigDict(from_attributes=True)

class SemesterWithDetails(Semester):
    courses: List[Course] = []
    widgets: List[Widget] = []
    tabs: List[Tab] = []
    plugin_settings: List[PluginSetting] = []
    plugin_activations: List["SemesterPluginActivation"] = []
    enabled_plugin_ids: List[str] = []
    runtime_plugins: List[dict[str, Any]] = []
    available_widget_types: List[str] = []
    resolved_plugin_settings: List[PluginSetting] = []


# --- Program Schemas ---
class ProgramBase(BaseModel):
    name: str
    cgpa_scaled: float = 0.0
    cgpa_percentage: float = 0.0
    gpa_scaling_table: Optional[str] = None
    subject_color_map: str = "{}"
    grad_requirement_credits: float = 0.0
    hide_gpa: bool = False
    program_timezone: str = "UTC"
    lms_integration_id: Optional[str] = None

class ProgramCreate(ProgramBase):
    pass

class ProgramUpdate(BaseModel):
    name: Optional[str] = None
    cgpa_scaled: Optional[float] = None
    cgpa_percentage: Optional[float] = None
    gpa_scaling_table: Optional[str] = None
    subject_color_map: Optional[str] = None
    grad_requirement_credits: Optional[float] = None
    hide_gpa: Optional[bool] = None
    program_timezone: Optional[str] = None
    lms_integration_id: Optional[str] = None

class Program(ProgramBase):
    id: str
    owner_id: str
    has_lms_dependencies: bool = False
    lms_integration: Optional[LmsIntegrationSummary] = None
    model_config = ConfigDict(from_attributes=True)

class ProgramWithSemesters(Program):
    semesters: List[SemesterWithDetails] = []
    plugin_installations: List["ProgramPluginInstallation"] = []


class ProgramPluginField(BaseModel):
    path: str
    label: Optional[str] = None
    type: Optional[str] = None
    scope: str
    default: Any = None
    description: str = ""
    options: List[dict[str, Any]] = []


class ProgramPluginSetupField(BaseModel):
    path: str
    label: str
    type: str
    persist: str
    required: bool = False
    default_value: Any = None
    description: str = ""
    placeholder: str = ""
    options: List[dict[str, Any]] = []
    summary_labels: dict[str, str] = {}


class ProgramPluginSetupSection(BaseModel):
    id: str
    title: str
    description: str = ""
    fields: List[ProgramPluginSetupField] = []


class ProgramPluginInstallationUpsertRequest(BaseModel):
    version: Optional[str] = None
    is_enabled: Optional[bool] = None
    auth_state: Optional[str] = None
    auth_message: Optional[str] = None
    program_settings: dict[str, Any] = {}


class ProgramPluginInstallationBulkUpdateRequest(BaseModel):
    plugin_ids: List[str]
    is_enabled: bool


class ProgramPluginInstallation(BaseModel):
    id: Optional[str] = None
    plugin_id: str
    display_name: str
    description: str
    long_description: str = ""
    author: str
    default_version: str
    default_installed: bool = False
    default_enabled: bool = False
    locked: bool = False
    version: str
    is_enabled: bool = True
    auth_state: str
    auth_message: Optional[str] = None
    requires_authorization: bool = False
    requires_program_lms_integration: bool = False
    capabilities: dict[str, Any] = {}
    setup_sections: List[ProgramPluginSetupSection] = []
    program_settings: dict[str, Any] = {}
    resolved_program_settings: dict[str, Any] = {}
    fields: List[ProgramPluginField] = []
    available: bool = False
    availability_reason: Optional[str] = None
    installed: bool = True


class ProgramPluginCatalogItem(ProgramPluginInstallation):
    installed: bool = False


class SemesterPluginActivationUpsertRequest(BaseModel):
    is_enabled: Optional[bool] = None


class SemesterPluginActivationBulkUpdateRequest(BaseModel):
    plugin_ids: List[str]
    is_enabled: bool


class SemesterDraftReviewIssue(BaseModel):
    code: str
    message: str
    step: str
    plugin_id: Optional[str] = None
    field_path: Optional[str] = None


class SemesterDraftReviewSummaryItem(BaseModel):
    path: str
    label: str
    value: str


class SemesterDraftReviewSummarySection(BaseModel):
    id: str
    title: str
    description: str = ""
    items: List[SemesterDraftReviewSummaryItem] = []


class SemesterPluginActivation(BaseModel):
    id: Optional[str] = None
    semester_id: str
    program_plugin_installation_id: str
    plugin_id: str
    display_name: str
    description: str
    long_description: str = ""
    author: str
    locked: bool = False
    version: str
    is_enabled: bool = True
    auth_state: str
    capabilities: dict[str, Any] = {}
    setup_sections: List[ProgramPluginSetupSection] = []
    semester_overrides: dict[str, Any] = {}
    setup_state: dict[str, Any] = {}
    resolved_settings: dict[str, Any] = {}
    fields: List[ProgramPluginField] = []
    setup_summary: List[SemesterDraftReviewSummarySection] = []
    review_errors: List[SemesterDraftReviewIssue] = []
    available: bool = False
    availability_reason: Optional[str] = None


class CoursePluginActivationUpsertRequest(BaseModel):
    is_enabled: Optional[bool] = None


class CoursePluginActivationBulkUpdateRequest(BaseModel):
    plugin_ids: List[str]
    is_enabled: bool


class CoursePluginActivation(BaseModel):
    id: Optional[str] = None
    course_id: str
    program_plugin_installation_id: str
    plugin_id: str
    display_name: str
    description: str
    long_description: str = ""
    author: str
    locked: bool = False
    version: str
    is_enabled: bool = True
    auth_state: str
    capabilities: dict[str, Any] = {}
    resolved_settings: dict[str, Any] = {}
    available: bool = False
    availability_reason: Optional[str] = None
    source: Literal["course", "semester"]


class PluginSystemSetupDefinitionResponse(BaseModel):
    plugin_id: str
    sections: List[ProgramPluginSetupSection] = []


class PluginSystemSemesterSetupPlugin(BaseModel):
    plugin_id: str
    display_name: str
    description: str
    long_description: str = ""
    author: str
    is_enabled: bool = True
    available: bool = False
    availability_reason: Optional[str] = None
    setup_sections: List[ProgramPluginSetupSection] = []
    setup_values: dict[str, Any] = {}
    setup_summary: List[SemesterDraftReviewSummarySection] = []
    review_errors: List[SemesterDraftReviewIssue] = []


class PluginSystemSemesterSetupResponse(BaseModel):
    semester_id: str
    step: str = "plugin-setup"
    plugins: List[PluginSystemSemesterSetupPlugin] = []


class PluginSystemSemesterSetupUpdateRequest(BaseModel):
    values: dict[str, Any] = {}


class PluginSystemSemesterSetupUpdateResponse(BaseModel):
    semester_id: str
    plugin_id: str
    setup_values: dict[str, Any] = {}
    setup_summary: List[SemesterDraftReviewSummarySection] = []
    review_errors: List[SemesterDraftReviewIssue] = []


class PluginSystemReviewPlugin(BaseModel):
    plugin_id: str
    review_errors: List[SemesterDraftReviewIssue] = []
    setup_summary: List[SemesterDraftReviewSummarySection] = []


class PluginSystemReviewResponse(BaseModel):
    semester_id: str
    plugins: List[PluginSystemReviewPlugin] = []
    has_errors: bool = False


class SemesterDraftCreateRequest(BaseModel):
    name: str = "Untitled Semester"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    reading_week_start: Optional[date] = None
    reading_week_end: Optional[date] = None
    creation_step: SemesterDraftStep = "basics"


class SemesterDraftUpdateRequest(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    reading_week_start: Optional[date] = None
    reading_week_end: Optional[date] = None
    creation_step: Optional[SemesterDraftStep] = None


class SemesterDraft(Semester):
    plugin_activations: List[SemesterPluginActivation] = []
    review_errors: List[SemesterDraftReviewIssue] = []

class WeekPattern(str, Enum):
    EVERY = "EVERY"
    ALTERNATING = "ALTERNATING"

# --- Course Event Type Schemas ---
class CourseEventTypeBase(BaseModel):
    code: str
    abbreviation: str
    track_attendance: bool = False
    color: Optional[str] = None
    icon: Optional[str] = None

class CourseEventTypeCreate(CourseEventTypeBase):
    pass

class CourseEventTypeUpdate(BaseModel):
    code: Optional[str] = None
    abbreviation: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    track_attendance: Optional[bool] = Field(default=None, alias="trackAttendance")

    model_config = ConfigDict(populate_by_name=True)

class CourseEventType(CourseEventTypeBase):
    id: str

    model_config = ConfigDict(from_attributes=True)

class CourseEventTypePatchResponse(BaseModel):
    event_type: CourseEventType
    normalized_events: int = 0

# --- Course Section Schemas ---
class CourseSectionBase(BaseModel):
    section_id: str = Field(alias="sectionId")
    event_type_code: str = Field(alias="eventTypeCode")
    title: Optional[str] = None
    instructor: Optional[str] = None
    location: Optional[str] = None
    day_of_week: int = Field(alias="dayOfWeek")
    start_time: str = Field(alias="startTime")
    end_time: str = Field(alias="endTime")
    week_pattern: WeekPattern = Field(default=WeekPattern.EVERY, alias="weekPattern")
    start_week: int = Field(default=1, alias="startWeek")
    end_week: int = Field(default=1, alias="endWeek")

    model_config = ConfigDict(populate_by_name=True)

class CourseSectionCreate(CourseSectionBase):
    pass

class CourseSectionUpdate(BaseModel):
    event_type_code: Optional[str] = Field(default=None, alias="eventTypeCode")
    title: Optional[str] = None
    instructor: Optional[str] = None
    location: Optional[str] = None
    day_of_week: Optional[int] = Field(default=None, alias="dayOfWeek")
    start_time: Optional[str] = Field(default=None, alias="startTime")
    end_time: Optional[str] = Field(default=None, alias="endTime")
    week_pattern: Optional[WeekPattern] = Field(default=None, alias="weekPattern")
    start_week: Optional[int] = Field(default=None, alias="startWeek")
    end_week: Optional[int] = Field(default=None, alias="endWeek")

    model_config = ConfigDict(populate_by_name=True)

class CourseSection(CourseSectionBase):
    id: str

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class CourseSectionImportItem(CourseSectionBase):
    pass

class CourseSectionImportRequest(BaseModel):
    items: List[CourseSectionImportItem]

# --- Course Event Schemas ---
class CourseEventBase(BaseModel):
    event_type_code: str = Field(alias="eventTypeCode")
    section_id: Optional[str] = Field(default=None, alias="sectionId")
    title: Optional[str] = None
    day_of_week: int = Field(alias="dayOfWeek")
    start_time: str = Field(alias="startTime")
    end_time: str = Field(alias="endTime")
    week_pattern: WeekPattern = Field(default=WeekPattern.EVERY, alias="weekPattern")
    start_week: Optional[int] = Field(default=1, alias="startWeek")
    end_week: Optional[int] = Field(default=None, alias="endWeek")
    enable: bool = True
    skip: bool = False
    note: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

class CourseEventCreate(CourseEventBase):
    pass

class CourseEventUpdate(BaseModel):
    event_type_code: Optional[str] = Field(default=None, alias="eventTypeCode")
    section_id: Optional[str] = Field(default=None, alias="sectionId")
    title: Optional[str] = None
    day_of_week: Optional[int] = Field(default=None, alias="dayOfWeek")
    start_time: Optional[str] = Field(default=None, alias="startTime")
    end_time: Optional[str] = Field(default=None, alias="endTime")
    week_pattern: Optional[WeekPattern] = Field(default=None, alias="weekPattern")
    start_week: Optional[int] = Field(default=None, alias="startWeek")
    end_week: Optional[int] = Field(default=None, alias="endWeek")
    enable: Optional[bool] = None
    skip: Optional[bool] = None
    note: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

class CourseEvent(CourseEventBase):
    id: str

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class CourseEventBatchItem(BaseModel):
    op: Literal["create", "update", "delete"]
    event_id: Optional[str] = Field(default=None, alias="eventId")
    data: Optional[dict] = None

    model_config = ConfigDict(populate_by_name=True)

class CourseEventBatchRequest(BaseModel):
    atomic: bool = True
    items: List[CourseEventBatchItem]

class BatchResultError(BaseModel):
    code: str
    message: str

class CourseEventBatchResult(BaseModel):
    index: int
    ok: bool
    event: Optional[CourseEvent] = None
    error: Optional[BatchResultError] = None

class CourseEventBatchResponse(BaseModel):
    atomic: bool
    total: int
    succeeded: int
    failed: int
    results: List[CourseEventBatchResult]

# --- Schedule Schemas ---
class ScheduleEventItem(BaseModel):
    event_id: str = Field(alias="eventId")
    course_id: str = Field(alias="courseId")
    course_name: str = Field(alias="courseName")
    event_type_code: str = Field(alias="eventTypeCode")
    section_id: Optional[str] = Field(default=None, alias="sectionId")
    day_of_week: int = Field(alias="dayOfWeek")
    start_time: str = Field(alias="startTime")
    end_time: str = Field(alias="endTime")
    week_pattern: WeekPattern = Field(default=WeekPattern.EVERY, alias="weekPattern")
    enable: bool
    skip: bool
    is_conflict: bool = Field(alias="isConflict")
    conflict_group_id: Optional[str] = Field(default=None, alias="conflictGroupId")
    week: int
    title: Optional[str] = None
    note: Optional[str] = None
    render_state: Optional[str] = Field(default=None, alias="renderState")

    model_config = ConfigDict(populate_by_name=True)

class ScheduleResponse(BaseModel):
    week: int
    max_week: int = Field(alias="maxWeek")
    items: List[ScheduleEventItem]
    warnings: List[str] = []

    model_config = ConfigDict(populate_by_name=True)

class ScheduleRangeResponse(BaseModel):
    start: date
    end: date
    items: List[ScheduleEventItem]
    warnings: List[str] = []

    model_config = ConfigDict(populate_by_name=True)

class ExportScope(str, Enum):
    COURSE = "course"
    SEMESTER = "semester"

class ExportRange(str, Enum):
    WEEK = "week"
    WEEKS = "weeks"
    TERM = "term"

class SkipRenderMode(str, Enum):
    HIDE_SKIPPED = "HIDE_SKIPPED"
    GRAY_SKIPPED = "GRAY_SKIPPED"

class ScheduleExportRequest(BaseModel):
    scope: ExportScope
    scope_id: str = Field(alias="scopeId")
    range: ExportRange
    week: Optional[int] = None
    start_week: Optional[int] = Field(default=None, alias="startWeek")
    end_week: Optional[int] = Field(default=None, alias="endWeek")
    skip_render_mode: SkipRenderMode = Field(default=SkipRenderMode.HIDE_SKIPPED, alias="skipRenderMode")

    model_config = ConfigDict(populate_by_name=True)

class JsonExportResponse(BaseModel):
    format: str
    scope: ExportScope
    scope_id: str = Field(alias="scopeId")
    weeks: List[int]
    item_count: int = Field(alias="itemCount")
    skip_render_mode: SkipRenderMode = Field(alias="skipRenderMode")
    items: List[ScheduleEventItem]

    model_config = ConfigDict(populate_by_name=True)

# --- Export/Import Schemas ---
class WidgetExport(BaseModel):
    widget_type: str
    layout_config: str = "{}"
    settings: str = "{}"
    is_removable: bool = True

class TabExport(BaseModel):
    tab_type: str
    settings: str = "{}"
    order_index: int = 0
    is_removable: bool = True
    is_draggable: bool = True

class PluginSettingExport(BaseModel):
    plugin_id: str
    settings: str = "{}"

class GradebookAssessmentCategoryExport(GradebookAssessmentCategoryBase):
    id: Optional[str] = None

class GradebookAssessmentExport(BaseModel):
    id: Optional[str] = None
    category_key: Optional[str] = None
    title: str
    due_date: Optional[date] = None
    weight: float = 0.0
    score: Optional[float] = None
    points_earned: Optional[float] = None
    points_possible: Optional[float] = None
    source_kind: Optional[str] = None
    source_external_id: Optional[str] = None
    order_index: int = 0

class CourseGradebookExport(BaseModel):
    revision: int = 1
    target_gpa: float = 4.0
    forecast_model: GradebookForecastModel = GradebookForecastModel.AUTO
    categories: List[GradebookAssessmentCategoryExport] = []
    assessments: List[GradebookAssessmentExport] = []

class LmsIntegrationExport(BaseModel):
    id: Optional[str] = None
    display_name: str
    provider: str
    status: str = "connected"
    config: dict[str, Any] = {}
    credentials: dict[str, Any] = {}
    last_checked_at: Optional[str] = None
    last_error: Optional[LmsIntegrationError] = None
    summary: Optional[LmsConnectionSummary] = None

class LmsCourseLinkExport(BaseModel):
    lms_integration_id: Optional[str] = None
    external_course_id: str
    external_course_code: Optional[str] = None
    external_name: Optional[str] = None
    sync_enabled: bool = True
    last_synced_at: Optional[str] = None
    last_error: Optional[LmsIntegrationError] = None

class CourseResourceExport(BaseModel):
    filename_original: str
    filename_display: str
    resource_kind: str = "file"
    external_url: Optional[str] = None
    mime_type: str = "application/octet-stream"
    size_bytes: int = 0
    content_base64: Optional[str] = None

class CourseEventTypeExport(CourseEventTypeBase):
    id: Optional[str] = None

class CourseSectionExport(CourseSectionBase):
    id: Optional[str] = None

class CourseEventExport(CourseEventBase):
    id: Optional[str] = None

class TodoSectionExport(BaseModel):
    id: Optional[str] = None
    name: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class TodoTaskExport(BaseModel):
    id: Optional[str] = None
    title: str
    note: str = ""
    due_date: Optional[date] = None
    due_time: Optional[str] = None
    priority: TodoPriority = TodoPriority.NONE
    completed: bool = False
    course_id: Optional[str] = None
    section_id: Optional[str] = None
    origin_section_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class TodoSemesterExport(BaseModel):
    sections: List[TodoSectionExport] = []
    tasks: List[TodoTaskExport] = []


class CoursePluginActivationExport(BaseModel):
    plugin_id: str
    is_enabled: bool = True


class CourseExport(BaseModel):
    id: Optional[str] = None
    name: str
    alias: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = None
    credits: float = 0.0
    grade_percentage: float = 0.0
    grade_scaled: float = 0.0
    include_in_gpa: bool = True
    hide_gpa: bool = False
    widgets: List[WidgetExport] = []
    tabs: List[TabExport] = []
    plugin_settings: List[PluginSettingExport] = []
    plugin_activations: List[CoursePluginActivationExport] = []
    gradebook: Optional[CourseGradebookExport] = None
    resource_files: List[CourseResourceExport] = []
    lms_link: Optional[LmsCourseLinkExport] = None
    event_types: List[CourseEventTypeExport] = []
    sections: List[CourseSectionExport] = []
    events: List[CourseEventExport] = []

class SemesterExport(BaseModel):
    id: Optional[str] = None
    name: str
    average_percentage: float = 0.0
    average_scaled: float = 0.0
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    reading_week_start: Optional[date] = None
    reading_week_end: Optional[date] = None
    courses: List[CourseExport] = []
    widgets: List[WidgetExport] = []
    tabs: List[TabExport] = []
    plugin_settings: List[PluginSettingExport] = []
    todo: Optional[TodoSemesterExport] = None

class ProgramExport(BaseModel):
    id: Optional[str] = None
    name: str
    cgpa_scaled: float = 0.0
    cgpa_percentage: float = 0.0
    gpa_scaling_table: Optional[str] = None
    subject_color_map: str = "{}"
    grad_requirement_credits: float = 0.0
    hide_gpa: bool = False
    program_timezone: str = "UTC"
    lms_integration_id: Optional[str] = None
    courses: List[CourseExport] = []
    semesters: List[SemesterExport] = []

class UserSettingsExport(BaseModel):
    nickname: Optional[str] = None
    gpa_scaling_table: Optional[str] = None
    default_course_credit: float = 0.0
    background_plugin_preload: bool = True

class UserDataExport(BaseModel):
    version: str = "1.0"
    exported_at: str
    settings: UserSettingsExport
    lms_integrations: List[LmsIntegrationExport] = []
    programs: List[ProgramExport] = []

class UserDataImport(BaseModel):
    version: Optional[str] = None
    settings: Optional[UserSettingsExport] = None
    lms_integrations: List[LmsIntegrationExport] = []
    programs: List[ProgramExport] = []


LmsCourseImportResult.model_rebuild()
LmsSemesterImportResponse.model_rebuild()
