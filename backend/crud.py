from sqlalchemy.orm import Session
import models
import schemas
import bcrypt

def verify_password(plain_password, hashed_password):
    # hashed_password from DB is string, bcrypt needs bytes
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    # Returns bytes, decode to store as string
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# --- User CRUD ---
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- Program CRUD ---
def get_programs(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Program).filter(models.Program.owner_id == user_id).offset(skip).limit(limit).all()

def create_program(db: Session, program: schemas.ProgramCreate, user_id: int):
    db_program = models.Program(**program.dict(), owner_id=user_id)
    db.add(db_program)
    db.commit()
    db.refresh(db_program)
    return db_program

def get_program(db: Session, program_id: int, user_id: int):
    return db.query(models.Program).filter(models.Program.id == program_id, models.Program.owner_id == user_id).first()

def update_program(db: Session, program_id: int, program_update: schemas.ProgramCreate, user_id: int):
    db_program = db.query(models.Program).filter(models.Program.id == program_id, models.Program.owner_id == user_id).first()
    if not db_program:
        return None
    for key, value in program_update.dict().items():
        setattr(db_program, key, value)
    db.add(db_program)
    db.commit()
    db.refresh(db_program)
    
    # Recalculate stats in case settings changed
    logic.recalculate_all_stats(db_program, db)
    
    return db_program

def delete_program(db: Session, program_id: int, user_id: int):
    db_program = db.query(models.Program).filter(models.Program.id == program_id, models.Program.owner_id == user_id).first()
    if db_program:
        db.delete(db_program)
        db.commit()
    return db_program

# --- Semester CRUD ---
def get_semesters(db: Session, program_id: int):
    # Verify program belongs to user (logic should be in route or here)
    # For now assuming simple fetch
    return db.query(models.Semester).filter(models.Semester.program_id == program_id).all()

def create_semester(db: Session, semester: schemas.SemesterCreate, program_id: int):
    db_semester = models.Semester(**semester.dict(), program_id=program_id)
    db.add(db_semester)
    db.commit()
    db.refresh(db_semester)
    return db_semester

def update_semester(db: Session, semester_id: int, semester_update: schemas.SemesterCreate):
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

def delete_semester(db: Session, semester_id: int):
    db_semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if db_semester:
        # Delete related courses logic handled by cascade in models?
        db.delete(db_semester)
        db.commit()
    return db_semester

import logic

# --- Course CRUD ---
def get_courses(db: Session, semester_id: int):
    return db.query(models.Course).filter(models.Course.semester_id == semester_id).all()

def get_course(db: Session, course_id: int):
    return db.query(models.Course).filter(models.Course.id == course_id).first()

def create_course(db: Session, course: schemas.CourseCreate, semester_id: int):
    db_course = models.Course(**course.dict(), semester_id=semester_id)
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    
    # Trigger logic
    logic.update_course_stats(db_course, db)
    
    return db_course

def update_course(db: Session, course_id: int, course_update: schemas.CourseCreate):
    db_course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not db_course:
        return None
    
    for key, value in course_update.dict().items():
        setattr(db_course, key, value)
    
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    
    # Trigger logic
    logic.update_course_stats(db_course, db)
    
    return db_course

# --- Widget CRUD ---
def create_widget(db: Session, widget: schemas.WidgetCreate, semester_id: int | None = None, course_id: int | None = None):
    # Ensure only one parent is set (though models allow both as nullable, logic likely implies one)
    # For now, just pass both. Logic caller ensures exclusivity if needed.
    db_widget = models.Widget(**widget.dict(), semester_id=semester_id, course_id=course_id)
    db.add(db_widget)
    db.commit()
    db.refresh(db_widget)
    return db_widget

def delete_widget(db: Session, widget_id: int):
    db_widget = db.query(models.Widget).filter(models.Widget.id == widget_id).first()
    if db_widget:
        db.delete(db_widget)
        db.commit()
    return db_widget

def update_widget(db: Session, widget_id: int, widget_update: schemas.WidgetBase): # Using Base or Create?
    db_widget = db.query(models.Widget).filter(models.Widget.id == widget_id).first()
    if not db_widget:
        return None
    for key, value in widget_update.dict().items():
        setattr(db_widget, key, value)
    db.add(db_widget)
    db.commit()
    db.refresh(db_widget)
    return db_widget
