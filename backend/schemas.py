from pydantic import BaseModel
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

class User(UserBase):
    id: int
    class Config:
        from_attributes = True

# --- Widget Schemas ---
class WidgetBase(BaseModel):
    widget_type: str
    title: str
    layout_config: str = "{}"
    settings: str = "{}"

class WidgetCreate(WidgetBase):
    pass

class Widget(WidgetBase):
    id: int
    semester_id: Optional[int] = None
    course_id: Optional[int] = None
    class Config:
        from_attributes = True

# --- Course Schemas ---
class CourseBase(BaseModel):
    name: str
    credits: float = 0.0
    grade_percentage: float = 0.0
    grade_scaled: float = 0.0
    gpa_scaling_table: Optional[str] = None
    include_in_gpa: bool = True
    hide_gpa: bool = False

class CourseCreate(CourseBase):
    pass

class Course(CourseBase):
    id: int
    semester_id: int
    class Config:
        from_attributes = True

class CourseWithWidgets(Course):
    widgets: List[Widget] = []


# --- Semester Schemas ---
class SemesterBase(BaseModel):
    name: str
    average_percentage: float = 0.0
    average_scaled: float = 0.0
    gpa_scaling_table: Optional[str] = None

class SemesterCreate(SemesterBase):
    pass

class Semester(SemesterBase):
    id: int
    program_id: int
    class Config:
        from_attributes = True

class SemesterWithDetails(Semester):
    courses: List[Course] = []
    widgets: List[Widget] = []


# --- Program Schemas ---
class ProgramBase(BaseModel):
    name: str
    cgpa_scaled: float = 0.0
    cgpa_percentage: float = 0.0
    gpa_scaling_table: Optional[str] = None
    grad_requirement_credits: float = 0.0

class ProgramCreate(ProgramBase):
    pass

class Program(ProgramBase):
    id: int
    owner_id: int
    class Config:
        from_attributes = True

class ProgramWithSemesters(Program):
    semesters: List[SemesterWithDetails] = []
