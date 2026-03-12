# input:  [SQLAlchemy Base, Column types, relational constraints]
# output: [ORM model classes and table definitions, including Program subject-color persistence, context-scoped plugin shared settings, and semester-scoped todo domain tables]
# pos:    [Persistent data model layer for academic data, dashboard instances, Program-level visual settings, plugin-shared settings, and todo domain records]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from database import Base
import uuid

def generate_uuid():
    return str(uuid.uuid4())

WEEK_PATTERN_VALUES = ("EVERY", "ALTERNATING")

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    email = Column(String, unique=True, index=True)
    nickname = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    google_sub = Column(String, unique=True, index=True, nullable=True)
    user_setting = Column(Text, default="{}")
    
    # Relationships
    programs = relationship("Program", back_populates="owner")
    
class Program(Base):
    __tablename__ = "programs"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    name = Column(String, index=True)
    owner_id = Column(String, ForeignKey("users.id"))
    program_timezone = Column(String, nullable=False, default="UTC")
    
    cgpa_scaled = Column(Float, default=0.0)
    cgpa_percentage = Column(Float, default=0.0)
    gpa_scaling_table = Column(Text, nullable=True) # JSON: {"90-100": 4.0, ...}
    subject_color_map = Column(Text, nullable=False, default="{}") # JSON: {"APS": "#2563eb", ...}
    grad_requirement_credits = Column(Float, default=0.0)
    hide_gpa = Column(Boolean, default=False)
    
    # Relationships
    owner = relationship("User", back_populates="programs")
    semesters = relationship("Semester", back_populates="program", cascade="all, delete-orphan")
    courses = relationship("Course", back_populates="program")


class Semester(Base):
    __tablename__ = "semesters"
    __table_args__ = (
        CheckConstraint("start_date <= end_date", name="ck_semesters_date_range"),
    )
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    name = Column(String, index=True)
    program_id = Column(String, ForeignKey("programs.id"))
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reading_week_start = Column(Date, nullable=True)
    reading_week_end = Column(Date, nullable=True)
    
    average_percentage = Column(Float, default=0.0)
    average_scaled = Column(Float, default=0.0)
    
    # Relationships
    program = relationship("Program", back_populates="semesters")
    courses = relationship("Course", back_populates="semester", cascade="all, delete-orphan")
    widgets = relationship("Widget", back_populates="semester_context", cascade="all, delete-orphan")
    tabs = relationship("Tab", back_populates="semester_context", cascade="all, delete-orphan")
    plugin_settings = relationship("PluginSetting", back_populates="semester_context", cascade="all, delete-orphan")
    todo_sections = relationship("TodoSection", back_populates="semester", cascade="all, delete-orphan")
    todo_tasks = relationship("TodoTask", back_populates="semester", cascade="all, delete-orphan")


class Course(Base):
    __tablename__ = "courses"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    name = Column(String, index=True)
    alias = Column(String, nullable=True)  # Optional alias to help identify the course
    category = Column(String, nullable=True) # Course category (e.g. "MIE", "ECE")
    color = Column(String, nullable=True)
    program_id = Column(String, ForeignKey("programs.id"), nullable=True) # Should be NOT NULL eventually
    semester_id = Column(String, ForeignKey("semesters.id"), nullable=True)
    
    credits = Column(Float, default=0.0)
    grade_percentage = Column(Float, default=0.0)
    grade_scaled = Column(Float, default=0.0)
    include_in_gpa = Column(Boolean, default=True)
    hide_gpa = Column(Boolean, default=False)
    
    # Relationships
    program = relationship("Program", back_populates="courses")
    semester = relationship("Semester", back_populates="courses")
    widgets = relationship("Widget", back_populates="course_context", cascade="all, delete-orphan")
    tabs = relationship("Tab", back_populates="course_context", cascade="all, delete-orphan")
    plugin_settings = relationship("PluginSetting", back_populates="course_context", cascade="all, delete-orphan")
    event_types = relationship("CourseEventType", back_populates="course", cascade="all, delete-orphan")
    sections = relationship("CourseSection", back_populates="course", cascade="all, delete-orphan")
    events = relationship("CourseEvent", back_populates="course", cascade="all, delete-orphan")
    gradebook = relationship("CourseGradebook", back_populates="course", uselist=False, cascade="all, delete-orphan")
    todo_tasks = relationship("TodoTask", back_populates="course")

    @property
    def has_gradebook(self) -> bool:
        return self.gradebook is not None

    @property
    def gradebook_revision(self) -> int:
        if self.gradebook is None:
            return 0
        return int(self.gradebook.revision or 0)

class CourseGradebook(Base):
    __tablename__ = "course_gradebooks"
    __table_args__ = (
        UniqueConstraint("course_id", name="uq_course_gradebooks_course_id"),
    )

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    target_gpa = Column(Float, nullable=False, default=4.0)
    forecast_model = Column(String, nullable=False, default="auto")
    revision = Column(Integer, nullable=False, default=1)
    created_at = Column(String, nullable=False, default="")
    updated_at = Column(String, nullable=False, default="")

    course = relationship("Course", back_populates="gradebook")
    categories = relationship(
        "GradebookAssessmentCategory",
        back_populates="gradebook",
        cascade="all, delete-orphan",
        order_by="GradebookAssessmentCategory.order_index.asc()",
    )
    assessments = relationship(
        "GradebookAssessment",
        back_populates="gradebook",
        cascade="all, delete-orphan",
        order_by="GradebookAssessment.order_index.asc()",
    )

class GradebookAssessmentCategory(Base):
    __tablename__ = "gradebook_assessment_categories"
    __table_args__ = (
        UniqueConstraint("gradebook_id", "key", name="uq_gradebook_categories_gradebook_key"),
        Index("ix_gradebook_categories_gradebook_order", "gradebook_id", "order_index"),
    )

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    gradebook_id = Column(String, ForeignKey("course_gradebooks.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    key = Column(String, nullable=False)
    is_builtin = Column(Boolean, nullable=False, default=False)
    color_token = Column(String, nullable=False, default="slate")
    order_index = Column(Integer, nullable=False, default=0)
    is_archived = Column(Boolean, nullable=False, default=False)

    gradebook = relationship("CourseGradebook", back_populates="categories")
    assessments = relationship("GradebookAssessment", back_populates="category")

class GradebookAssessment(Base):
    __tablename__ = "gradebook_assessments"
    __table_args__ = (
        Index("ix_gradebook_assessments_gradebook_order", "gradebook_id", "order_index"),
    )

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    gradebook_id = Column(String, ForeignKey("course_gradebooks.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(String, ForeignKey("gradebook_assessment_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String, nullable=False)
    due_date = Column(Date, nullable=True)
    weight = Column(Float, nullable=False, default=0.0)
    score = Column(Float, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    created_at = Column(String, nullable=False, default="")
    updated_at = Column(String, nullable=False, default="")

    gradebook = relationship("CourseGradebook", back_populates="assessments")
    category = relationship("GradebookAssessmentCategory", back_populates="assessments")

class CourseEventType(Base):
    __tablename__ = "course_event_types"
    __table_args__ = (
        UniqueConstraint("course_id", "code", name="uq_course_event_types_course_code"),
        UniqueConstraint("course_id", "abbreviation", name="uq_course_event_types_course_abbreviation"),
        Index("ix_course_event_types_course_code", "course_id", "code"),
    )

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String, nullable=False)
    abbreviation = Column(String, nullable=False)
    track_attendance = Column(Boolean, nullable=False, default=False)
    color = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    created_at = Column(String, nullable=False, default="")
    updated_at = Column(String, nullable=False, default="")

    course = relationship("Course", back_populates="event_types")

class CourseSection(Base):
    __tablename__ = "course_sections"
    __table_args__ = (
        ForeignKeyConstraint(
            ["course_id", "event_type_code"],
            ["course_event_types.course_id", "course_event_types.code"],
            ondelete="CASCADE",
            name="fk_course_sections_event_type",
        ),
        UniqueConstraint("course_id", "section_id", name="uq_course_sections_course_section"),
        CheckConstraint("day_of_week >= 1 AND day_of_week <= 7", name="ck_course_sections_day_of_week"),
        CheckConstraint("start_time < end_time", name="ck_course_sections_time_range"),
        CheckConstraint("start_week <= end_week", name="ck_course_sections_week_range"),
        CheckConstraint(
            f"week_pattern IN {WEEK_PATTERN_VALUES}",
            name="ck_course_sections_week_pattern",
        ),
        Index("ix_course_sections_course_day_time", "course_id", "day_of_week", "start_time", "end_time"),
    )

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    section_id = Column(String, nullable=False)
    event_type_code = Column(String, nullable=False)
    title = Column(String, nullable=True)
    instructor = Column(String, nullable=True)
    location = Column(String, nullable=True)
    day_of_week = Column(Integer, nullable=False)
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    week_pattern = Column(String, nullable=False, default="EVERY")
    start_week = Column(Integer, nullable=False, default=1)
    end_week = Column(Integer, nullable=False, default=1)
    created_at = Column(String, nullable=False, default="")
    updated_at = Column(String, nullable=False, default="")

    course = relationship("Course", back_populates="sections")

class CourseEvent(Base):
    __tablename__ = "course_events"
    __table_args__ = (
        ForeignKeyConstraint(
            ["course_id", "event_type_code"],
            ["course_event_types.course_id", "course_event_types.code"],
            ondelete="CASCADE",
            name="fk_course_events_event_type",
        ),
        ForeignKeyConstraint(
            ["course_id", "section_id"],
            ["course_sections.course_id", "course_sections.section_id"],
            ondelete="CASCADE",
            name="fk_course_events_section",
        ),
        CheckConstraint("day_of_week >= 1 AND day_of_week <= 7", name="ck_course_events_day_of_week"),
        CheckConstraint("start_time < end_time", name="ck_course_events_time_range"),
        CheckConstraint(
            "(end_week IS NULL) OR (start_week <= end_week)",
            name="ck_course_events_week_range",
        ),
        CheckConstraint(
            f"week_pattern IN {WEEK_PATTERN_VALUES}",
            name="ck_course_events_week_pattern",
        ),
        Index("ix_course_events_course_enable_day_time", "course_id", "enable", "day_of_week", "start_time", "end_time"),
        Index("ix_course_events_course_week_range", "course_id", "week_pattern", "start_week", "end_week"),
        Index("ix_course_events_course_event_type", "course_id", "event_type_code"),
        Index("ix_course_events_course_section", "course_id", "section_id"),
    )

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type_code = Column(String, nullable=False)
    section_id = Column(String, nullable=True)
    title = Column(String, nullable=True)
    day_of_week = Column(Integer, nullable=False)
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    week_pattern = Column(String, nullable=False, default="EVERY")
    start_week = Column(Integer, nullable=False, default=1)
    end_week = Column(Integer, nullable=True)
    enable = Column(Boolean, nullable=False, default=True)
    skip = Column(Boolean, nullable=False, default=False)
    note = Column(String, nullable=True)
    created_at = Column(String, nullable=False, default="")
    updated_at = Column(String, nullable=False, default="")

    course = relationship("Course", back_populates="events")

class TodoSection(Base):
    __tablename__ = "todo_sections"
    __table_args__ = (
        UniqueConstraint("semester_id", "name", name="uq_todo_sections_semester_name"),
    )

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    semester_id = Column(String, ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    created_at = Column(String, nullable=False, default="")
    updated_at = Column(String, nullable=False, default="")

    semester = relationship("Semester", back_populates="todo_sections")
    tasks = relationship(
        "TodoTask",
        back_populates="section",
        cascade="all",
        foreign_keys="TodoTask.section_id",
    )
    origin_tasks = relationship(
        "TodoTask",
        back_populates="origin_section",
        foreign_keys="TodoTask.origin_section_id",
    )

class TodoTask(Base):
    __tablename__ = "todo_tasks"
    __table_args__ = (
        CheckConstraint("priority IN ('', 'LOW', 'MEDIUM', 'HIGH', 'URGENT')", name="ck_todo_tasks_priority"),
        Index("ix_todo_tasks_semester_course", "semester_id", "course_id"),
    )

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    semester_id = Column(String, ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(String, ForeignKey("courses.id", ondelete="SET NULL"), nullable=True, index=True)
    section_id = Column(String, ForeignKey("todo_sections.id", ondelete="SET NULL"), nullable=True, index=True)
    origin_section_id = Column(String, ForeignKey("todo_sections.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String, nullable=False)
    note = Column(Text, nullable=False, default="")
    due_date = Column(Date, nullable=True)
    due_time = Column(String, nullable=True)
    priority = Column(String, nullable=False, default="")
    completed = Column(Boolean, nullable=False, default=False)
    created_at = Column(String, nullable=False, default="")
    updated_at = Column(String, nullable=False, default="")

    semester = relationship("Semester", back_populates="todo_tasks")
    course = relationship("Course", back_populates="todo_tasks")
    section = relationship("TodoSection", back_populates="tasks", foreign_keys=[section_id])
    origin_section = relationship("TodoSection", back_populates="origin_tasks", foreign_keys=[origin_section_id])

class Widget(Base):
    __tablename__ = "widgets"
    __table_args__ = (
        CheckConstraint(
            "((semester_id IS NOT NULL AND course_id IS NULL) OR (semester_id IS NULL AND course_id IS NOT NULL))",
            name="ck_widgets_single_context",
        ),
    )
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    widget_type = Column(String, index=True) # e.g., "course-list", "counter"
    
    # Layout props
    layout_config = Column(Text, default="{}") # JSON: {x, y, w, h}
    
    # Data/Settings
    settings = Column(Text, default="{}") # JSON: {min, max, value...}
    is_removable = Column(Boolean, default=True)
    
    # Parent Context (Polymorphic-ish, or just optional FKs)
    semester_id = Column(String, ForeignKey("semesters.id"), nullable=True)
    course_id = Column(String, ForeignKey("courses.id"), nullable=True)
    
    # Relationships
    semester_context = relationship("Semester", back_populates="widgets")
    course_context = relationship("Course", back_populates="widgets")

class Tab(Base):
    __tablename__ = "tabs"
    __table_args__ = (
        CheckConstraint(
            "((semester_id IS NOT NULL AND course_id IS NULL) OR (semester_id IS NULL AND course_id IS NOT NULL))",
            name="ck_tabs_single_context",
        ),
    )

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    tab_type = Column(String, index=True)
    settings = Column(Text, default="{}")
    order_index = Column(Integer, default=0)
    is_removable = Column(Boolean, default=True)
    is_draggable = Column(Boolean, default=True)

    semester_id = Column(String, ForeignKey("semesters.id"), nullable=True)
    course_id = Column(String, ForeignKey("courses.id"), nullable=True)

    semester_context = relationship("Semester", back_populates="tabs")
    course_context = relationship("Course", back_populates="tabs")

class PluginSetting(Base):
    __tablename__ = "plugin_settings"
    __table_args__ = (
        CheckConstraint(
            "((semester_id IS NOT NULL AND course_id IS NULL) OR (semester_id IS NULL AND course_id IS NOT NULL))",
            name="ck_plugin_settings_single_context",
        ),
        UniqueConstraint("plugin_id", "semester_id", name="uq_plugin_settings_plugin_semester"),
        UniqueConstraint("plugin_id", "course_id", name="uq_plugin_settings_plugin_course"),
    )

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    plugin_id = Column(String, nullable=False, index=True)
    settings = Column(Text, default="{}")

    semester_id = Column(String, ForeignKey("semesters.id"), nullable=True)
    course_id = Column(String, ForeignKey("courses.id"), nullable=True)

    semester_context = relationship("Semester", back_populates="plugin_settings")
    course_context = relationship("Course", back_populates="plugin_settings")
