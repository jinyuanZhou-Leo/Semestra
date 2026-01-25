from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, Text, Enum
from sqlalchemy.orm import relationship
from database import Base
import uuid

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    gpa_scaling_table = Column(Text, nullable=True)
    
    # Relationships
    programs = relationship("Program", back_populates="owner")
    
class Program(Base):
    __tablename__ = "programs"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    name = Column(String, index=True)
    owner_id = Column(String, ForeignKey("users.id"))
    
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
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    name = Column(String, index=True)
    program_id = Column(String, ForeignKey("programs.id"))
    
    average_percentage = Column(Float, default=0.0)
    average_scaled = Column(Float, default=0.0)
    gpa_scaling_table = Column(Text, nullable=True) # JSON override
    
    # Relationships
    program = relationship("Program", back_populates="semesters")
    courses = relationship("Course", back_populates="semester", cascade="all, delete-orphan")
    widgets = relationship("Widget", back_populates="semester_context", cascade="all, delete-orphan")


class Course(Base):
    __tablename__ = "courses"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    name = Column(String, index=True)
    semester_id = Column(String, ForeignKey("semesters.id"))
    
    credits = Column(Float, default=0.0)
    grade_percentage = Column(Float, default=0.0)
    grade_scaled = Column(Float, default=0.0)
    gpa_scaling_table = Column(Text, nullable=True) # JSON override
    include_in_gpa = Column(Boolean, default=True)
    hide_gpa = Column(Boolean, default=False)
    
    # Relationships
    semester = relationship("Semester", back_populates="courses")
    widgets = relationship("Widget", back_populates="course_context", cascade="all, delete-orphan")

class Widget(Base):
    __tablename__ = "widgets"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    widget_type = Column(String, index=True) # e.g., "course-list", "counter"
    title = Column(String)
    
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
