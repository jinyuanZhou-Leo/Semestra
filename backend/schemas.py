from pydantic import BaseModel, Field, validator
from typing import List, Optional, Any, Literal
from enum import Enum
from datetime import date

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

    @validator('password')
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
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    nickname: Optional[str] = None
    user_setting: Optional[str] = None
    # Backward-compatible fields that are merged into user_setting.
    gpa_scaling_table: Optional[str] = None
    default_course_credit: Optional[float] = None

class GoogleAuthRequest(BaseModel):
    id_token: str

# --- Widget Schemas ---
class WidgetBase(BaseModel):
    widget_type: str
    layout_config: str = "{}"
    settings: str = "{}"
    is_removable: bool = True

class WidgetCreate(WidgetBase):
    pass

class Widget(WidgetBase):
    id: str
    semester_id: Optional[str] = None
    course_id: Optional[str] = None
    class Config:
        from_attributes = True

class WidgetUpdate(BaseModel):
    widget_type: Optional[str] = None
    layout_config: Optional[str] = None
    settings: Optional[str] = None

# --- Tab Schemas ---
class TabBase(BaseModel):
    tab_type: str
    settings: str = "{}"
    order_index: int = 0
    is_removable: bool = True

class TabCreate(TabBase):
    order_index: Optional[int] = None

class Tab(TabBase):
    id: str
    semester_id: Optional[str] = None
    course_id: Optional[str] = None
    class Config:
        from_attributes = True

class TabUpdate(BaseModel):
    settings: Optional[str] = None
    order_index: Optional[int] = None

# --- Course Schemas ---
class CourseBase(BaseModel):
    name: str
    alias: Optional[str] = None
    category: Optional[str] = None
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
    class Config:
        from_attributes = True

class CourseWithWidgets(Course):
    widgets: List[Widget] = []
    tabs: List[Tab] = []


# --- Semester Schemas ---
class SemesterBase(BaseModel):
    name: str
    average_percentage: float = 0.0
    average_scaled: float = 0.0
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class SemesterCreate(SemesterBase):
    pass

class Semester(SemesterBase):
    id: str
    program_id: str
    class Config:
        from_attributes = True

class SemesterWithDetails(Semester):
    courses: List[Course] = []
    widgets: List[Widget] = []
    tabs: List[Tab] = []


# --- Program Schemas ---
class ProgramBase(BaseModel):
    name: str
    cgpa_scaled: float = 0.0
    cgpa_percentage: float = 0.0
    gpa_scaling_table: Optional[str] = None
    grad_requirement_credits: float = 0.0
    hide_gpa: bool = False
    program_timezone: str = "UTC"

class ProgramCreate(ProgramBase):
    pass

class ProgramUpdate(BaseModel):
    name: Optional[str] = None
    cgpa_scaled: Optional[float] = None
    cgpa_percentage: Optional[float] = None
    gpa_scaling_table: Optional[str] = None
    grad_requirement_credits: Optional[float] = None
    hide_gpa: Optional[bool] = None
    program_timezone: Optional[str] = None

class Program(ProgramBase):
    id: str
    owner_id: str
    class Config:
        from_attributes = True

class ProgramWithSemesters(Program):
    semesters: List[SemesterWithDetails] = []

class WeekPattern(str, Enum):
    EVERY = "EVERY"
    ODD = "ODD"
    EVEN = "EVEN"

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

    class Config:
        populate_by_name = True

class CourseEventType(CourseEventTypeBase):
    id: str

    class Config:
        from_attributes = True

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

    class Config:
        populate_by_name = True

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

    class Config:
        populate_by_name = True

class CourseSection(CourseSectionBase):
    id: str

    class Config:
        from_attributes = True
        populate_by_name = True

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

    class Config:
        populate_by_name = True

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

    class Config:
        populate_by_name = True

class CourseEvent(CourseEventBase):
    id: str

    class Config:
        from_attributes = True
        populate_by_name = True

class CourseEventBatchItem(BaseModel):
    op: Literal["create", "update", "delete"]
    event_id: Optional[str] = Field(default=None, alias="eventId")
    data: Optional[dict] = None

    class Config:
        populate_by_name = True

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
    enable: bool
    skip: bool
    is_conflict: bool = Field(alias="isConflict")
    conflict_group_id: Optional[str] = Field(default=None, alias="conflictGroupId")
    week: int
    title: Optional[str] = None
    note: Optional[str] = None
    render_state: Optional[str] = Field(default=None, alias="renderState")

    class Config:
        populate_by_name = True

class ScheduleResponse(BaseModel):
    week: int
    max_week: int = Field(alias="maxWeek")
    items: List[ScheduleEventItem]
    warnings: List[str] = []

    class Config:
        populate_by_name = True

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

    class Config:
        populate_by_name = True

class JsonExportResponse(BaseModel):
    format: str
    scope: ExportScope
    scope_id: str = Field(alias="scopeId")
    weeks: List[int]
    item_count: int = Field(alias="itemCount")
    skip_render_mode: SkipRenderMode = Field(alias="skipRenderMode")
    items: List[ScheduleEventItem]

    class Config:
        populate_by_name = True

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

class CourseExport(BaseModel):
    name: str
    alias: Optional[str] = None
    category: Optional[str] = None
    credits: float = 0.0
    grade_percentage: float = 0.0
    grade_scaled: float = 0.0
    include_in_gpa: bool = True
    hide_gpa: bool = False
    widgets: List[WidgetExport] = []
    tabs: List[TabExport] = []

class SemesterExport(BaseModel):
    name: str
    average_percentage: float = 0.0
    average_scaled: float = 0.0
    courses: List[CourseExport] = []
    widgets: List[WidgetExport] = []
    tabs: List[TabExport] = []

class ProgramExport(BaseModel):
    name: str
    cgpa_scaled: float = 0.0
    cgpa_percentage: float = 0.0
    gpa_scaling_table: Optional[str] = None
    grad_requirement_credits: float = 0.0
    hide_gpa: bool = False
    semesters: List[SemesterExport] = []

class UserSettingsExport(BaseModel):
    nickname: Optional[str] = None
    gpa_scaling_table: Optional[str] = None
    default_course_credit: float = 0.0

class UserDataExport(BaseModel):
    version: str = "1.0"
    exported_at: str
    settings: UserSettingsExport
    programs: List[ProgramExport] = []

class UserDataImport(BaseModel):
    version: Optional[str] = None
    settings: Optional[UserSettingsExport] = None
    programs: List[ProgramExport] = []
