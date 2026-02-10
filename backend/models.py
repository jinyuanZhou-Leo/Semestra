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

WEEK_PATTERN_VALUES = ("EVERY", "ODD", "EVEN")

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
    grad_requirement_credits = Column(Float, default=0.0)
    hide_gpa = Column(Boolean, default=False)
    
    # Relationships
    owner = relationship("User", back_populates="programs")
    semesters = relationship("Semester", back_populates="program", cascade="all, delete-orphan")


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
    
    average_percentage = Column(Float, default=0.0)
    average_scaled = Column(Float, default=0.0)
    
    # Relationships
    program = relationship("Program", back_populates="semesters")
    courses = relationship("Course", back_populates="semester", cascade="all, delete-orphan")
    widgets = relationship("Widget", back_populates="semester_context", cascade="all, delete-orphan")
    tabs = relationship("Tab", back_populates="semester_context", cascade="all, delete-orphan")


class Course(Base):
    __tablename__ = "courses"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    name = Column(String, index=True)
    alias = Column(String, nullable=True)  # Optional alias to help identify the course
    category = Column(String, nullable=True) # Course category (e.g. "MIE", "ECE")
    program_id = Column(String, ForeignKey("programs.id"), nullable=True) # Should be NOT NULL eventually
    semester_id = Column(String, ForeignKey("semesters.id"), nullable=True)
    
    credits = Column(Float, default=0.0)
    grade_percentage = Column(Float, default=0.0)
    grade_scaled = Column(Float, default=0.0)
    include_in_gpa = Column(Boolean, default=True)
    hide_gpa = Column(Boolean, default=False)
    
    # Relationships
    semester = relationship("Semester", back_populates="courses")
    widgets = relationship("Widget", back_populates="course_context", cascade="all, delete-orphan")
    tabs = relationship("Tab", back_populates="course_context", cascade="all, delete-orphan")
    event_types = relationship("CourseEventType", back_populates="course", cascade="all, delete-orphan")
    sections = relationship("CourseSection", back_populates="course", cascade="all, delete-orphan")
    events = relationship("CourseEvent", back_populates="course", cascade="all, delete-orphan")

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
