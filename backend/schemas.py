from pydantic import BaseModel, validator
from typing import List, Optional, Any
from enum import Enum

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

class ProgramCreate(ProgramBase):
    pass

class ProgramUpdate(BaseModel):
    name: Optional[str] = None
    cgpa_scaled: Optional[float] = None
    cgpa_percentage: Optional[float] = None
    gpa_scaling_table: Optional[str] = None
    grad_requirement_credits: Optional[float] = None
    hide_gpa: Optional[bool] = None

class Program(ProgramBase):
    id: str
    owner_id: str
    class Config:
        from_attributes = True

class ProgramWithSemesters(Program):
    semesters: List[SemesterWithDetails] = []


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
