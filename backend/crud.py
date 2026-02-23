# input:  [SQLAlchemy session, models, schemas, timezone/date helpers]
# output: [CRUD functions for users, tasks, courses, widgets, and settings]
# pos:    [Database access layer for backend services]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from sqlalchemy.orm import Session
from sqlalchemy import func
import json
from datetime import date, timedelta
from zoneinfo import ZoneInfo
import models
import schemas
import bcrypt

DEFAULT_GPA_SCALING = '{"90-100": 4.0, "85-89": 4.0, "80-84": 3.7, "77-79": 3.3, "73-76": 3.0, "70-72": 2.7, "67-69": 2.3, "63-66": 2.0, "60-62": 1.7, "57-59": 1.3, "53-56": 1.0, "50-52": 0.7, "0-49": 0}'
DEFAULT_COURSE_CREDIT = 0.5
DEFAULT_PROGRAM_TIMEZONE = "UTC"
DEFAULT_SEMESTER_LENGTH_DAYS = 111
BUILTIN_EVENT_TYPES = [
    {"code": "LECTURE", "abbreviation": "LEC"},
    {"code": "TUTORIAL", "abbreviation": "TUT"},
    {"code": "PRACTICAL", "abbreviation": "PRA"},
]

def normalize_timezone(timezone_value: str | None) -> str:
    timezone = (timezone_value or DEFAULT_PROGRAM_TIMEZONE).strip()
    try:
        ZoneInfo(timezone)
    except Exception as exc:
        raise ValueError("INVALID_TIMEZONE") from exc
    return timezone

def get_default_semester_dates(today: date | None = None) -> tuple[date, date]:
    base = today or date.today()
    return base, base + timedelta(days=DEFAULT_SEMESTER_LENGTH_DAYS)

def get_default_user_setting_dict() -> dict:
    return {
        "gpa_scaling_table": DEFAULT_GPA_SCALING,
        "default_course_credit": DEFAULT_COURSE_CREDIT,
    }

def parse_user_setting(raw_setting: str | None) -> dict:
    if not raw_setting:
        return {}
    try:
        parsed = json.loads(raw_setting)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}

def normalize_user_setting_dict(settings: dict | None) -> dict:
    normalized = dict(settings) if isinstance(settings, dict) else {}

    gpa_table = normalized.get("gpa_scaling_table")
    if not isinstance(gpa_table, str) or not gpa_table:
        normalized["gpa_scaling_table"] = DEFAULT_GPA_SCALING

    default_credit = normalized.get("default_course_credit")
    if isinstance(default_credit, (int, float)):
        normalized["default_course_credit"] = float(default_credit)
    else:
        normalized["default_course_credit"] = DEFAULT_COURSE_CREDIT

    return normalized

def get_user_setting_dict(user: models.User | None) -> dict:
    settings = parse_user_setting(getattr(user, "user_setting", None)) if user else {}
    return normalize_user_setting_dict(settings)

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
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        user_setting=json.dumps(get_default_user_setting_dict())
    )
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
        user_setting=json.dumps(get_default_user_setting_dict())
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

    update_data = user_update.dict(exclude_unset=True)

    if "nickname" in update_data:
        db_user.nickname = update_data["nickname"]

    merged_settings = get_user_setting_dict(db_user)
    has_settings_update = False

    if "user_setting" in update_data and update_data["user_setting"] is not None:
        incoming = parse_user_setting(update_data["user_setting"])
        if incoming:
            merged_settings.update(incoming)
            has_settings_update = True

    if "gpa_scaling_table" in update_data and update_data["gpa_scaling_table"] is not None:
        merged_settings["gpa_scaling_table"] = update_data["gpa_scaling_table"]
        has_settings_update = True

    if "default_course_credit" in update_data and update_data["default_course_credit"] is not None:
        merged_settings["default_course_credit"] = float(update_data["default_course_credit"])
        has_settings_update = True

    merged_settings = normalize_user_setting_dict(merged_settings)

    if has_settings_update or not db_user.user_setting:
        db_user.user_setting = json.dumps(merged_settings)

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- Program CRUD ---
def get_programs(db: Session, user_id: str, skip: int = 0, limit: int = 100):
    return db.query(models.Program).filter(models.Program.owner_id == user_id).offset(skip).limit(limit).all()

def create_program(db: Session, program: schemas.ProgramCreate, user_id: str):
    payload = program.dict()
    payload["program_timezone"] = normalize_timezone(payload.get("program_timezone"))
    db_program = models.Program(**payload, owner_id=user_id)
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
    update_data = program_update.dict(exclude_unset=True)
    if "program_timezone" in update_data:
        update_data["program_timezone"] = normalize_timezone(update_data["program_timezone"])
    for key, value in update_data.items():
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
    payload = semester.dict()
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
    if start_date is None or end_date is None:
        default_start, default_end = get_default_semester_dates()
        payload["start_date"] = start_date or default_start
        payload["end_date"] = end_date or default_end
    db_semester = models.Semester(**payload, program_id=program_id)
    db.add(db_semester)
    db.commit()
    db.refresh(db_semester)
    
    # Create default widgets
    create_widget(db, schemas.WidgetCreate(
        widget_type="course-list",
        is_removable=False
    ), semester_id=db_semester.id)
    
    return db_semester

def update_semester(db: Session, semester_id: str, semester_update: schemas.SemesterCreate):
    db_semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if not db_semester:
        return None
    update_data = semester_update.dict()
    if update_data.get("start_date") is None:
        update_data["start_date"] = db_semester.start_date
    if update_data.get("end_date") is None:
        update_data["end_date"] = db_semester.end_date
    for key, value in update_data.items():
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
def get_courses(db: Session, program_id: str, semester_id: str | None = None, unassigned: bool = False):
    query = db.query(models.Course).filter(models.Course.program_id == program_id)
    if unassigned:
        query = query.filter(models.Course.semester_id == None)
    elif semester_id:
        query = query.filter(models.Course.semester_id == semester_id)
    return query.all()

def get_course(db: Session, course_id: str):
    return db.query(models.Course).filter(models.Course.id == course_id).first()

def create_course(db: Session, course: schemas.CourseCreate, program_id: str, semester_id: str | None = None):
    db_course = models.Course(**course.dict(), program_id=program_id, semester_id=semester_id)
    db.add(db_course)
    db.commit()
    db.refresh(db_course)

    for builtin_type in BUILTIN_EVENT_TYPES:
        db.add(models.CourseEventType(
            course_id=db_course.id,
            code=builtin_type["code"],
            abbreviation=builtin_type["abbreviation"],
            track_attendance=False,
            created_at="",
            updated_at="",
        ))
    db.commit()

    # Create default widgets
    create_widget(db, schemas.WidgetCreate(
        widget_type="grade-calculator",
        is_removable=False
    ), course_id=db_course.id)

    # Trigger logic
    if semester_id:
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
    if db_course.semester_id:
        logic.update_course_stats(db_course, db)
    
    return db_course

def _ensure_widget_context(semester_id: str | None, course_id: str | None):
    if (semester_id is None and course_id is None) or (semester_id is not None and course_id is not None):
        raise ValueError("Widget must be attached to exactly one context (semester_id or course_id).")

def _ensure_tab_context(semester_id: str | None, course_id: str | None):
    if (semester_id is None and course_id is None) or (semester_id is not None and course_id is not None):
        raise ValueError("Tab must be attached to exactly one context (semester_id or course_id).")

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

# --- Tab CRUD ---
def _get_next_tab_order(db: Session, semester_id: str | None, course_id: str | None) -> int:
    query = db.query(func.max(models.Tab.order_index))
    if semester_id:
        query = query.filter(models.Tab.semester_id == semester_id)
    if course_id:
        query = query.filter(models.Tab.course_id == course_id)
    max_order = query.scalar()
    return int(max_order or 0) + 1

def create_tab(db: Session, tab: schemas.TabCreate, semester_id: str | None = None, course_id: str | None = None):
    _ensure_tab_context(semester_id, course_id)
    data = tab.dict()
    order_index = data.pop("order_index", None)
    if order_index is None:
        order_index = _get_next_tab_order(db, semester_id, course_id)
    data["order_index"] = order_index
    db_tab = models.Tab(**data, semester_id=semester_id, course_id=course_id)
    db.add(db_tab)
    db.commit()
    db.refresh(db_tab)
    return db_tab

def delete_tab(db: Session, tab_id: str):
    db_tab = db.query(models.Tab).filter(models.Tab.id == tab_id).first()
    if db_tab:
        db.delete(db_tab)
        db.commit()
    return db_tab

def update_tab(db: Session, tab_id: str, tab_update: schemas.TabUpdate):
    db_tab = db.query(models.Tab).filter(models.Tab.id == tab_id).first()
    if not db_tab:
        return None
    for key, value in tab_update.dict(exclude_unset=True).items():
        setattr(db_tab, key, value)
    db.add(db_tab)
    db.commit()
    db.refresh(db_tab)
    return db_tab
