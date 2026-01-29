from sqlalchemy.orm import Session
import models
import schemas
import bcrypt

DEFAULT_GPA_SCALING = '{"90-100": 4.0, "85-89": 4.0, "80-84": 3.7, "77-79": 3.3, "73-76": 3.0, "70-72": 2.7, "67-69": 2.3, "63-66": 2.0, "60-62": 1.7, "57-59": 1.3, "53-56": 1.0, "50-52": 0.7, "0-49": 0}'

def verify_password(plain_password, hashed_password):
    if not hashed_password:
        return False
    # hashed_password from DB is string, bcrypt needs bytes
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    # Returns bytes, decode to store as string
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# --- User CRUD ---
def get_user(db: Session, user_id: str):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_google_sub(db: Session, google_sub: str):
    return db.query(models.User).filter(models.User.google_sub == google_sub).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_password, gpa_scaling_table=DEFAULT_GPA_SCALING)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    db.refresh(db_user)
    return db_user

def create_user_from_google(db: Session, email: str, google_sub: str):
    db_user = models.User(
        email=email,
        hashed_password=None,
        google_sub=google_sub,
        gpa_scaling_table=DEFAULT_GPA_SCALING
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: str, user_update: schemas.UserUpdate):
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    for key, value in user_update.dict(exclude_unset=True).items():
        setattr(db_user, key, value)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- Program CRUD ---
def get_programs(db: Session, user_id: str, skip: int = 0, limit: int = 100):
    return db.query(models.Program).filter(models.Program.owner_id == user_id).offset(skip).limit(limit).all()

def create_program(db: Session, program: schemas.ProgramCreate, user_id: str):
    db_program = models.Program(**program.dict(), owner_id=user_id)
    db.add(db_program)
    db.commit()
    db.refresh(db_program)
    return db_program

def get_program(db: Session, program_id: str, user_id: str):
    return db.query(models.Program).filter(models.Program.id == program_id, models.Program.owner_id == user_id).first()

def update_program(db: Session, program_id: str, program_update: schemas.ProgramUpdate, user_id: str):
    db_program = db.query(models.Program).filter(models.Program.id == program_id, models.Program.owner_id == user_id).first()
    if not db_program:
        return None
    for key, value in program_update.dict(exclude_unset=True).items():
        setattr(db_program, key, value)
    db.add(db_program)
    db.commit()
    db.refresh(db_program)
    
    # Recalculate stats in case settings changed
    logic.recalculate_all_stats(db_program, db)
    
    return db_program

def delete_program(db: Session, program_id: str, user_id: str):
    db_program = db.query(models.Program).filter(models.Program.id == program_id, models.Program.owner_id == user_id).first()
    if db_program:
        db.delete(db_program)
        db.commit()
    return db_program

# --- Semester CRUD ---
def get_semesters(db: Session, program_id: str):
    # Verify program belongs to user (logic should be in route or here)
    # For now assuming simple fetch
    return db.query(models.Semester).filter(models.Semester.program_id == program_id).all()

def create_semester(db: Session, semester: schemas.SemesterCreate, program_id: str):
    db_semester = models.Semester(**semester.dict(), program_id=program_id)
    db.add(db_semester)
    db.commit()
    db.refresh(db_semester)
    
    # Create default widgets
    create_widget(db, schemas.WidgetCreate(
        widget_type="course-list",
        title="Courses",
        is_removable=False
    ), semester_id=db_semester.id)
    
    return db_semester

def update_semester(db: Session, semester_id: str, semester_update: schemas.SemesterCreate):
    db_semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if not db_semester:
        return None
    for key, value in semester_update.dict().items():
        setattr(db_semester, key, value)
    db.add(db_semester)
    db.commit()
    db.refresh(db_semester)
    
    # Recalculate stats
    logic.recalculate_semester_full(db_semester, db)
    
    return db_semester

def delete_semester(db: Session, semester_id: str):
    db_semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if db_semester:
        # Delete related courses logic handled by cascade in models?
        db.delete(db_semester)
        db.commit()
    return db_semester

import logic

# --- Course CRUD ---
def get_courses(db: Session, semester_id: str):
    return db.query(models.Course).filter(models.Course.semester_id == semester_id).all()

def get_course(db: Session, course_id: str):
    return db.query(models.Course).filter(models.Course.id == course_id).first()

def create_course(db: Session, course: schemas.CourseCreate, semester_id: str):
    db_course = models.Course(**course.dict(), semester_id=semester_id)
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    
    # Trigger logic
    logic.update_course_stats(db_course, db)
    
    return db_course

def update_course(db: Session, course_id: str, course_update: schemas.CourseUpdate):
    db_course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not db_course:
        return None
    
    for key, value in course_update.dict(exclude_unset=True).items():
        setattr(db_course, key, value)
    
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    
    # Trigger logic
    logic.update_course_stats(db_course, db)
    
    return db_course

def _ensure_widget_context(semester_id: str | None, course_id: str | None):
    if (semester_id is None and course_id is None) or (semester_id is not None and course_id is not None):
        raise ValueError("Widget must be attached to exactly one context (semester_id or course_id).")

# --- Widget CRUD ---
def create_widget(db: Session, widget: schemas.WidgetCreate, semester_id: str | None = None, course_id: str | None = None):
    _ensure_widget_context(semester_id, course_id)
    db_widget = models.Widget(**widget.dict(), semester_id=semester_id, course_id=course_id)
    db.add(db_widget)
    db.commit()
    db.refresh(db_widget)
    return db_widget

def delete_widget(db: Session, widget_id: str):
    db_widget = db.query(models.Widget).filter(models.Widget.id == widget_id).first()
    if db_widget:
        db.delete(db_widget)
        db.commit()
    return db_widget

def update_widget(db: Session, widget_id: str, widget_update: schemas.WidgetUpdate):
    db_widget = db.query(models.Widget).filter(models.Widget.id == widget_id).first()
    if not db_widget:
        return None
    for key, value in widget_update.dict(exclude_unset=True).items():
        setattr(db_widget, key, value)
    db.add(db_widget)
    db.commit()
    db.refresh(db_widget)
    return db_widget
