# input:  [FastAPI framework, schemas/models/crud/logic/utils/auth modules]
# output: [FastAPI app instance and all HTTP route handlers]
# pos:    [Backend entry point and API orchestration layer]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from fastapi import FastAPI, Depends, HTTPException, status, Form, Query
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from typing import Any, Optional
import math
import json
import os
from pathlib import Path
from dotenv import load_dotenv
from icalendar import Calendar, Event as ICalEvent

from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

import models
import schemas
import crud
import auth
from database import engine, get_db

BASE_DIR = Path(__file__).parent
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Load .env only for local development. Production should use platform env vars.
if ENVIRONMENT == "development":
    env_local_path = BASE_DIR / ".env"
    if env_local_path.exists():
        load_dotenv(env_local_path)

models.Base.metadata.create_all(bind=engine)

def ensure_schema_compatibility():
    inspector = inspect(engine)

    if inspector.has_table("programs"):
        program_columns = {column["name"] for column in inspector.get_columns("programs")}
        if "program_timezone" not in program_columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE programs ADD COLUMN program_timezone VARCHAR DEFAULT 'UTC'"))
                connection.execute(text("UPDATE programs SET program_timezone = 'UTC' WHERE program_timezone IS NULL OR program_timezone = ''"))
        else:
            with engine.begin() as connection:
                connection.execute(text("UPDATE programs SET program_timezone = 'UTC' WHERE program_timezone IS NULL OR program_timezone = ''"))

    if inspector.has_table("semesters"):
        semester_columns = {column["name"] for column in inspector.get_columns("semesters")}
        if "start_date" not in semester_columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE semesters ADD COLUMN start_date DATE"))
                connection.execute(text("UPDATE semesters SET start_date = DATE('now') WHERE start_date IS NULL"))
        if "end_date" not in semester_columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE semesters ADD COLUMN end_date DATE"))
                connection.execute(text("UPDATE semesters SET end_date = DATE(start_date, '+111 day') WHERE end_date IS NULL"))
        else:
            with engine.begin() as connection:
                connection.execute(text("UPDATE semesters SET end_date = DATE(start_date, '+111 day') WHERE end_date IS NULL"))

    if inspector.has_table("tabs"):
        tab_columns = {column["name"] for column in inspector.get_columns("tabs")}
        if "is_draggable" not in tab_columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE tabs ADD COLUMN is_draggable BOOLEAN DEFAULT 1"))
                connection.execute(text("UPDATE tabs SET is_draggable = 1 WHERE is_draggable IS NULL"))
        else:
            with engine.begin() as connection:
                connection.execute(text("UPDATE tabs SET is_draggable = 1 WHERE is_draggable IS NULL"))

ensure_schema_compatibility()

from fastapi import UploadFile, File
import utils

app = FastAPI()

# Environment variables
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# CORS configuration
origins = [
    FRONTEND_URL,
    "https://semestrauni.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
origins = list({o for o in origins if o})

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TIME_FORMAT = "%H:%M"
BUILTIN_EVENT_TYPE_CODES = {"LECTURE", "TUTORIAL", "PRACTICAL"}
BUILTIN_EVENT_TYPE_ABBREVIATIONS = {
    "LECTURE": "LEC",
    "TUTORIAL": "TUT",
    "PRACTICAL": "PRA",
}

def now_utc_iso() -> str:
    return datetime.utcnow().isoformat()

def error_detail(code: str, message: str) -> dict:
    return {"code": code, "message": message}

def validate_time_range(start_time: str, end_time: str):
    try:
        datetime.strptime(start_time, TIME_FORMAT)
        datetime.strptime(end_time, TIME_FORMAT)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_TIME_FORMAT", "Time must use HH:mm format."),
        ) from exc

    if start_time >= end_time:
        raise HTTPException(
            status_code=422,
            detail=error_detail(
                "INVALID_TIME_RANGE_CROSS_DAY_NOT_SUPPORTED",
                "startTime must be earlier than endTime",
            ),
        )

def validate_week_range(start_week: Optional[int], end_week: Optional[int], code_prefix: str):
    if start_week is not None and start_week < 1:
        raise HTTPException(
            status_code=422,
            detail=error_detail(f"{code_prefix}_INVALID_START_WEEK", "startWeek must be greater than or equal to 1."),
        )
    if end_week is not None and end_week < 1:
        raise HTTPException(
            status_code=422,
            detail=error_detail(f"{code_prefix}_INVALID_END_WEEK", "endWeek must be greater than or equal to 1."),
        )
    if start_week is not None and end_week is not None and start_week > end_week:
        raise HTTPException(
            status_code=422,
            detail=error_detail(f"{code_prefix}_INVALID_WEEK_RANGE", "startWeek must be less than or equal to endWeek."),
        )

def validate_day_of_week(day_of_week: int):
    if day_of_week < 1 or day_of_week > 7:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_DAY_OF_WEEK", "dayOfWeek must be in range 1..7."),
        )

def validate_section_id(section_id: str):
    if not section_id.isdigit():
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_SECTION_ID_FORMAT", "sectionId must contain digits only."),
        )

def normalize_week_pattern(value: str) -> str:
    normalized = value.upper()
    if normalized not in {"EVERY", "ALTERNATING"}:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_WEEK_PATTERN", "weekPattern must be EVERY or ALTERNATING."),
        )
    return normalized

def normalize_week_pattern_input(value: Any) -> str:
    if hasattr(value, "value"):
        value = value.value
    return normalize_week_pattern(str(value))

def get_owned_course(db: Session, current_user: models.User, course_id: str) -> models.Course:
    course = (
        db.query(models.Course)
        .join(models.Program, models.Course.program_id == models.Program.id)
        .filter(models.Course.id == course_id, models.Program.owner_id == current_user.id)
        .first()
    )
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course

def get_owned_semester(db: Session, current_user: models.User, semester_id: str) -> models.Semester:
    semester = (
        db.query(models.Semester)
        .join(models.Program, models.Semester.program_id == models.Program.id)
        .filter(models.Semester.id == semester_id, models.Program.owner_id == current_user.id)
        .first()
    )
    if semester is None:
        raise HTTPException(status_code=404, detail="Semester not found")
    return semester

def get_event_type_or_404(db: Session, course_id: str, event_type_code: str) -> models.CourseEventType:
    event_type = (
        db.query(models.CourseEventType)
        .filter(models.CourseEventType.course_id == course_id, models.CourseEventType.code == event_type_code)
        .first()
    )
    if event_type is None:
        raise HTTPException(
            status_code=422,
            detail=error_detail("EVENT_TYPE_NOT_FOUND", f"eventTypeCode '{event_type_code}' does not exist for this course."),
        )
    return event_type

def get_section_or_422(db: Session, course_id: str, section_id: Optional[str]) -> Optional[models.CourseSection]:
    if section_id is None:
        return None
    section = (
        db.query(models.CourseSection)
        .filter(models.CourseSection.course_id == course_id, models.CourseSection.section_id == section_id)
        .first()
    )
    if section is None:
        raise HTTPException(
            status_code=422,
            detail=error_detail("SECTION_NOT_FOUND", f"sectionId '{section_id}' does not exist for this course."),
        )
    return section

def validate_program_timezone_or_422(timezone: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_TIMEZONE", "Invalid IANA timezone string."),
        ) from exc

def get_semester_max_week(semester: models.Semester) -> int:
    total_days = (semester.end_date - semester.start_date).days + 1
    return max(1, math.ceil(total_days / 7))

def resolve_week_index(semester: models.Semester, timezone: str, requested_week: Optional[int]) -> int:
    max_week = get_semester_max_week(semester)
    if requested_week is not None:
        if requested_week < 1 or requested_week > max_week:
            raise HTTPException(
                status_code=422,
                detail=error_detail("INVALID_WEEK_INDEX", f"week must be between 1 and {max_week}."),
            )
        return requested_week

    tzinfo = validate_program_timezone_or_422(timezone)
    today = datetime.now(tzinfo).date()
    if semester.start_date <= today <= semester.end_date:
        return ((today - semester.start_date).days // 7) + 1
    return 1

def matches_week_pattern(week_pattern: str, week: int, start_week: Optional[int] = 1) -> bool:
    if week_pattern == "EVERY":
        return True
    if week_pattern == "ALTERNATING":
        anchor_week = start_week or 1
        return (week - anchor_week) % 2 == 0
    return False

def parse_time_value(value: str) -> time:
    return datetime.strptime(value, TIME_FORMAT).time()

def week_date(semester_start: date, week: int, day_of_week: int) -> date:
    return semester_start + timedelta(days=((week - 1) * 7 + (day_of_week - 1)))

def detect_conflicts(items: list[dict]) -> list[dict]:
    active_indices: list[int] = []
    for index, item in enumerate(items):
        if item["enable"] and not item["skip"]:
            active_indices.append(index)

    parent = {idx: idx for idx in active_indices}

    def find_parent(x: int) -> int:
        if parent[x] != x:
            parent[x] = find_parent(parent[x])
        return parent[x]

    def union(a: int, b: int):
        root_a = find_parent(a)
        root_b = find_parent(b)
        if root_a != root_b:
            parent[root_b] = root_a

    for i in range(len(active_indices)):
        idx_a = active_indices[i]
        a = items[idx_a]
        for j in range(i + 1, len(active_indices)):
            idx_b = active_indices[j]
            b = items[idx_b]
            if a["course_id"] == b["course_id"]:
                continue
            if a["day_of_week"] != b["day_of_week"]:
                continue
            if a["start_time"] < b["end_time"] and b["start_time"] < a["end_time"]:
                union(idx_a, idx_b)

    groups: dict[int, list[int]] = {}
    for idx in active_indices:
        root = find_parent(idx)
        groups.setdefault(root, []).append(idx)

    conflict_counter = 1
    for members in groups.values():
        if len(members) <= 1:
            continue
        group_id = f"conflict-{conflict_counter}"
        conflict_counter += 1
        for member_index in members:
            items[member_index]["is_conflict"] = True
            items[member_index]["conflict_group_id"] = group_id
    return items

def serialize_schedule_item(item: dict, include_render_state: bool = False) -> dict:
    payload = {
        "eventId": item["event_id"],
        "courseId": item["course_id"],
        "courseName": item["course_name"],
        "eventTypeCode": item["event_type_code"],
        "sectionId": item["section_id"],
        "dayOfWeek": item["day_of_week"],
        "startTime": item["start_time"],
        "endTime": item["end_time"],
        "weekPattern": item.get("week_pattern", "EVERY"),
        "enable": item["enable"],
        "skip": item["skip"],
        "isConflict": item.get("is_conflict", False),
        "conflictGroupId": item.get("conflict_group_id"),
        "week": item["week"],
    }
    if item.get("title") is not None:
        payload["title"] = item["title"]
    if item.get("note") is not None:
        payload["note"] = item["note"]
    if include_render_state and item.get("render_state"):
        payload["renderState"] = item["render_state"]
    return payload

def event_to_week_item(
    event: models.CourseEvent,
    course_name: str,
    week: int,
    max_week: int,
    warnings: list[str],
) -> Optional[dict]:
    try:
        validate_time_range(event.start_time, event.end_time)
        validate_day_of_week(event.day_of_week)
    except HTTPException:
        warnings.append(f"Skipped invalid event '{event.id}' due to invalid time/day data.")
        return None

    effective_start_week = event.start_week or 1
    effective_end_week = event.end_week or max_week
    if effective_start_week > effective_end_week:
        warnings.append(f"Skipped invalid event '{event.id}' due to invalid week range.")
        return None
    if week < effective_start_week or week > effective_end_week:
        return None
    if not matches_week_pattern(event.week_pattern, week, effective_start_week):
        return None
    if not event.enable:
        return None

    return {
        "event_id": event.id,
        "course_id": event.course_id,
        "course_name": course_name,
        "event_type_code": event.event_type_code,
        "section_id": event.section_id,
        "day_of_week": event.day_of_week,
        "start_time": event.start_time,
        "end_time": event.end_time,
        "week_pattern": event.week_pattern,
        "enable": event.enable,
        "skip": event.skip,
        "is_conflict": False,
        "conflict_group_id": None,
        "week": week,
        "title": event.title,
        "note": event.note,
    }

def collect_semester_week_items(
    db: Session,
    semester: models.Semester,
    week: int,
) -> tuple[list[dict], list[str]]:
    max_week = get_semester_max_week(semester)
    warnings: list[str] = []
    courses = db.query(models.Course).filter(models.Course.semester_id == semester.id).all()
    events = (
        db.query(models.CourseEvent)
        .join(models.Course, models.CourseEvent.course_id == models.Course.id)
        .filter(models.Course.semester_id == semester.id)
        .all()
    )
    course_name_map = {course.id: course.name for course in courses}

    items: list[dict] = []
    for event in events:
        item = event_to_week_item(
            event=event,
            course_name=course_name_map.get(event.course_id, "Unknown Course"),
            week=week,
            max_week=max_week,
            warnings=warnings,
        )
        if item is not None:
            items.append(item)
    return items, warnings

def collect_course_week_items(
    db: Session,
    course: models.Course,
    semester: models.Semester,
    week: int,
) -> tuple[list[dict], list[str]]:
    max_week = get_semester_max_week(semester)
    warnings: list[str] = []
    events = db.query(models.CourseEvent).filter(models.CourseEvent.course_id == course.id).all()
    items: list[dict] = []
    for event in events:
        item = event_to_week_item(
            event=event,
            course_name=course.name,
            week=week,
            max_week=max_week,
            warnings=warnings,
        )
        if item is not None:
            items.append(item)
    return items, warnings

def get_course_semester_and_timezone(
    db: Session,
    current_user: models.User,
    course_id: str,
) -> tuple[models.Course, models.Semester, str]:
    course = get_owned_course(db, current_user, course_id)
    if not course.semester_id:
        raise HTTPException(
            status_code=422,
            detail=error_detail("COURSE_NOT_IN_SEMESTER", "Course is not assigned to a semester."),
        )
    semester = get_owned_semester(db, current_user, course.semester_id)
    program = crud.get_program(db, course.program_id, current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    timezone = (program.program_timezone or "UTC").strip() or "UTC"
    return course, semester, timezone

def parse_export_weeks(
    export_range: schemas.ExportRange,
    provided_week: Optional[int],
    start_week: Optional[int],
    end_week: Optional[int],
    semester: models.Semester,
    timezone: str,
) -> list[int]:
    max_week = get_semester_max_week(semester)
    if export_range == schemas.ExportRange.TERM:
        return list(range(1, max_week + 1))
    if export_range == schemas.ExportRange.WEEK:
        resolved_week = resolve_week_index(semester, timezone, provided_week)
        return [resolved_week]

    validate_week_range(start_week, end_week, "EXPORT")
    if start_week is None or end_week is None:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_EXPORT_WEEK_RANGE", "startWeek and endWeek are required when range is weeks."),
        )
    if start_week > max_week or end_week > max_week:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_WEEK_INDEX", f"week must be between 1 and {max_week}."),
        )
    return list(range(start_week, end_week + 1))

def normalize_event_skip(db: Session, course_id: str, event_type_code: str, skip_value: bool) -> bool:
    event_type = get_event_type_or_404(db, course_id, event_type_code)
    if event_type.track_attendance:
        return False
    return skip_value

def touch_model_timestamp(model_instance):
    model_instance.updated_at = now_utc_iso()
    if getattr(model_instance, "created_at", None) in (None, ""):
        model_instance.created_at = model_instance.updated_at

def derive_event_type_abbreviation(code: str) -> str:
    builtin = BUILTIN_EVENT_TYPE_ABBREVIATIONS.get(code.upper())
    if builtin:
        return builtin
    normalized = "".join(character for character in code.upper() if character.isalnum())
    return (normalized[:4] or "TYPE")

def resolve_unique_event_type_abbreviation(db: Session, course_id: str, event_type_code: str) -> str:
    preferred = derive_event_type_abbreviation(event_type_code)
    existing_abbreviations = {
        row[0]
        for row in (
            db.query(models.CourseEventType.abbreviation)
            .filter(models.CourseEventType.course_id == course_id)
            .all()
        )
        if row[0]
    }
    if preferred not in existing_abbreviations:
        return preferred

    normalized_code = "".join(character for character in event_type_code.upper() if character.isalnum()) or "TYPE"
    base = normalized_code[:3] if len(normalized_code) >= 3 else normalized_code
    sequence = 2
    while sequence < 1000:
        candidate = f"{base}{sequence}"
        if candidate not in existing_abbreviations:
            return candidate
        sequence += 1

    # Fallback guard; practically unreachable unless the course has extreme abbreviation cardinality.
    return f"{normalized_code}{int(datetime.utcnow().timestamp())}"

def ensure_builtin_event_types_for_course(db: Session, course_id: str):
    existing_codes = {
        row[0]
        for row in (
            db.query(models.CourseEventType.code)
            .filter(models.CourseEventType.course_id == course_id)
            .all()
        )
    }
    missing_codes = sorted(BUILTIN_EVENT_TYPE_CODES - existing_codes)
    for code in missing_codes:
        ensure_course_event_type_exists(db, course_id, code)

def ensure_course_event_type_exists(db: Session, course_id: str, event_type_code: str) -> models.CourseEventType:
    event_type_code = event_type_code.strip()
    existing = (
        db.query(models.CourseEventType)
        .filter(models.CourseEventType.course_id == course_id, models.CourseEventType.code == event_type_code)
        .first()
    )
    if existing:
        return existing

    event_type = models.CourseEventType(
        course_id=course_id,
        code=event_type_code,
        abbreviation=resolve_unique_event_type_abbreviation(db, course_id, event_type_code),
        track_attendance=False,
        created_at="",
        updated_at="",
    )
    touch_model_timestamp(event_type)
    db.add(event_type)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        recovered = (
            db.query(models.CourseEventType)
            .filter(models.CourseEventType.course_id == course_id, models.CourseEventType.code == event_type_code)
            .first()
        )
        if recovered:
            return recovered
        raise HTTPException(
            status_code=422,
            detail=error_detail(
                "EVENT_TYPE_CREATE_CONFLICT",
                f"Failed to create eventTypeCode '{event_type_code}' due to a unique constraint conflict.",
            ),
        ) from exc
    return event_type

def import_course_schedule_from_ics(
    db: Session,
    course: models.Course,
    meetings: list[dict[str, Any]],
):
    for meeting in meetings:
        event_type_code = str(meeting.get("eventTypeCode", "")).strip() or "LECTURE"
        ensure_course_event_type_exists(db, course.id, event_type_code)

        day_of_week = int(meeting.get("dayOfWeek", 1))
        start_time = str(meeting.get("startTime", "09:00")).strip()
        end_time = str(meeting.get("endTime", "10:00")).strip()
        week_pattern = normalize_week_pattern_input(meeting.get("weekPattern", "EVERY"))
        start_week = int(meeting.get("startWeek", 1))
        end_week = int(meeting.get("endWeek", start_week))

        validate_day_of_week(day_of_week)
        validate_time_range(start_time, end_time)
        validate_week_range(start_week, end_week, "EVENT")

        section_id_raw = meeting.get("sectionId")
        section_id = str(section_id_raw).strip() if section_id_raw else None
        linked_section_id: str | None = None

        if section_id:
            validate_section_id(section_id)
            existing_section = (
                db.query(models.CourseSection)
                .filter(models.CourseSection.course_id == course.id, models.CourseSection.section_id == section_id)
                .first()
            )
            if existing_section is None:
                section_payload = {
                    "section_id": section_id,
                    "event_type_code": event_type_code,
                    "title": meeting.get("title"),
                    "instructor": meeting.get("instructor"),
                    "location": meeting.get("location"),
                    "day_of_week": day_of_week,
                    "start_time": start_time,
                    "end_time": end_time,
                    "week_pattern": week_pattern,
                    "start_week": start_week,
                    "end_week": end_week,
                }
                validate_section_payload(course.id, section_payload, db)
                db_section = models.CourseSection(course_id=course.id, **section_payload)
                touch_model_timestamp(db_section)
                db.add(db_section)
                linked_section_id = section_id
            elif existing_section.event_type_code == event_type_code:
                linked_section_id = section_id

        db_event = models.CourseEvent(
            course_id=course.id,
            event_type_code=event_type_code,
            section_id=linked_section_id,
            title=meeting.get("title"),
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
            week_pattern=week_pattern,
            start_week=start_week,
            end_week=end_week,
            enable=True,
            skip=False,
            note=meeting.get("note"),
        )
        touch_model_timestamp(db_event)
        db.add(db_event)

def verify_google_id_token(id_token: str) -> dict:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google client ID is not configured")
    try:
        payload = google_id_token.verify_oauth2_token(
            id_token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        return payload
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

@app.post("/auth/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

@app.post("/auth/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), remember_me: bool = Form(False), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not crud.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if remember_me:
        access_token_expires = timedelta(days=15)
    else:
        access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
        
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/google", response_model=schemas.Token)
def login_with_google(payload: schemas.GoogleAuthRequest, db: Session = Depends(get_db)):
    google_payload = verify_google_id_token(payload.id_token)
    email = google_payload.get("email")
    email_verified = google_payload.get("email_verified")
    sub = google_payload.get("sub")

    if isinstance(email_verified, str):
        email_verified = email_verified.lower() == "true"
    if not email_verified:
        raise HTTPException(status_code=400, detail="Google email is not verified")
    if not email or not sub:
        raise HTTPException(status_code=400, detail="Google token missing email or subject")

    user = crud.get_user_by_google_sub(db, google_sub=sub)
    if user:
        access_token = auth.create_access_token(
            data={"sub": user.email}, expires_delta=timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return {"access_token": access_token, "token_type": "bearer"}

    user = crud.get_user_by_email(db, email=email)
    if user:
        if user.google_sub and user.google_sub != sub:
            raise HTTPException(status_code=409, detail="Google account already linked to another user")
        user.google_sub = sub
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user = crud.create_user_from_google(db, email=email, google_sub=sub)

    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/google/link")
def link_google_account(payload: schemas.GoogleAuthRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    google_payload = verify_google_id_token(payload.id_token)
    email = google_payload.get("email")
    email_verified = google_payload.get("email_verified")
    sub = google_payload.get("sub")

    if isinstance(email_verified, str):
        email_verified = email_verified.lower() == "true"
    if not email_verified:
        raise HTTPException(status_code=400, detail="Google email is not verified")
    if not email or not sub:
        raise HTTPException(status_code=400, detail="Google token missing email or subject")
    if current_user.email.lower() != email.lower():
        raise HTTPException(status_code=400, detail="Google email does not match current user")

    existing = crud.get_user_by_google_sub(db, google_sub=sub)
    if existing and existing.id != current_user.id:
        raise HTTPException(status_code=409, detail="Google account already linked to another user")
    if current_user.google_sub and current_user.google_sub != sub:
        raise HTTPException(status_code=409, detail="Current user already linked to a different Google account")

    current_user.google_sub = sub
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return {"ok": True}

@app.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.put("/users/me", response_model=schemas.User)
async def update_user_me(user_update: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.update_user(db, current_user.id, user_update)

@app.get("/users/me/export", response_model=schemas.UserDataExport)
async def export_user_data(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Export all user data (programs, semesters, courses, widgets, tabs)."""
    programs = crud.get_programs(db, user_id=current_user.id)
    
    programs_export = []
    for program in programs:
        semesters_export = []
        for semester in program.semesters:
            # Courses for this semester
            courses_export = []
            for course in semester.courses:
                widgets_export = [
                    schemas.WidgetExport(
                        widget_type=w.widget_type,
                        layout_config=w.layout_config,
                        settings=w.settings,
                        is_removable=w.is_removable
                    ) for w in course.widgets
                ]
                tabs_export = [
                    schemas.TabExport(
                        tab_type=t.tab_type,
                        settings=t.settings,
                        order_index=t.order_index,
                        is_removable=t.is_removable,
                        is_draggable=t.is_draggable
                    ) for t in course.tabs
                ]
                courses_export.append(schemas.CourseExport(
                    name=course.name,
                    alias=course.alias,
                    credits=course.credits,
                    grade_percentage=course.grade_percentage,
                    grade_scaled=course.grade_scaled,
                    include_in_gpa=course.include_in_gpa,
                    hide_gpa=course.hide_gpa,
                    widgets=widgets_export,
                    tabs=tabs_export
                ))
            
            # Semester widgets and tabs
            semester_widgets = [
                schemas.WidgetExport(
                    widget_type=w.widget_type,
                    layout_config=w.layout_config,
                    settings=w.settings,
                    is_removable=w.is_removable
                ) for w in semester.widgets
            ]
            semester_tabs = [
                schemas.TabExport(
                    tab_type=t.tab_type,
                    settings=t.settings,
                    order_index=t.order_index,
                    is_removable=t.is_removable,
                    is_draggable=t.is_draggable
                ) for t in semester.tabs
            ]
            
            semesters_export.append(schemas.SemesterExport(
                name=semester.name,
                average_percentage=semester.average_percentage,
                average_scaled=semester.average_scaled,
                courses=courses_export,
                widgets=semester_widgets,
                tabs=semester_tabs
            ))
        
        programs_export.append(schemas.ProgramExport(
            name=program.name,
            cgpa_scaled=program.cgpa_scaled,
            cgpa_percentage=program.cgpa_percentage,
            gpa_scaling_table=program.gpa_scaling_table,
            grad_requirement_credits=program.grad_requirement_credits,
            hide_gpa=program.hide_gpa,
            semesters=semesters_export
        ))

    user_setting = crud.get_user_setting_dict(current_user)
    
    return schemas.UserDataExport(
        version="1.0",
        exported_at=datetime.utcnow().isoformat(),
        settings=schemas.UserSettingsExport(
            nickname=current_user.nickname,
            gpa_scaling_table=user_setting["gpa_scaling_table"],
            default_course_credit=user_setting["default_course_credit"]
        ),
        programs=programs_export
    )

@app.post("/users/me/import")
async def import_user_data(
    data: schemas.UserDataImport,
    conflict_mode: str = "skip",
    include_settings: bool = True,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Import user data with smart conflict handling.
    conflict_mode: 'skip' (ignore conflicts), 'overwrite' (replace existing), 'rename' (add suffix)
    """
    if conflict_mode not in ["skip", "overwrite", "rename"]:
        raise HTTPException(status_code=400, detail="conflict_mode must be 'skip', 'overwrite', or 'rename'")
    
    # Get existing program names for conflict detection
    existing_programs = crud.get_programs(db, user_id=current_user.id)
    existing_names = {p.name.lower(): p for p in existing_programs}
    
    # Import settings if provided and requested
    if include_settings and data.settings:
        update_data = {}
        user_setting = crud.get_user_setting_dict(current_user)
        if data.settings.nickname is not None:
            update_data["nickname"] = data.settings.nickname
        if data.settings.gpa_scaling_table is not None:
            user_setting["gpa_scaling_table"] = data.settings.gpa_scaling_table
        if data.settings.default_course_credit is not None:
            user_setting["default_course_credit"] = data.settings.default_course_credit
        if (
            data.settings.gpa_scaling_table is not None
            or data.settings.default_course_credit is not None
        ):
            update_data["user_setting"] = json.dumps(user_setting)
        if update_data:
            crud.update_user(db, current_user.id, schemas.UserUpdate(**update_data))
    
    # Import programs with conflict handling
    imported_programs = 0
    skipped_programs = 0
    imported_semesters = 0
    imported_courses = 0
    
    def import_program_data(program_data, program_name: str):
        """Helper to import a program and its nested data."""
        nonlocal imported_programs, imported_semesters, imported_courses
        
        program = crud.create_program(
            db=db,
            program=schemas.ProgramCreate(
                name=program_name,
                cgpa_scaled=program_data.cgpa_scaled,
                cgpa_percentage=program_data.cgpa_percentage,
                gpa_scaling_table=program_data.gpa_scaling_table,
                grad_requirement_credits=program_data.grad_requirement_credits,
                hide_gpa=program_data.hide_gpa
            ),
            user_id=current_user.id
        )
        imported_programs += 1
        
        for semester_data in program_data.semesters:
            semester = crud.create_semester(
                db=db,
                semester=schemas.SemesterCreate(
                    name=semester_data.name,
                    average_percentage=semester_data.average_percentage,
                    average_scaled=semester_data.average_scaled
                ),
                program_id=program.id
            )
            imported_semesters += 1
            
            # Create semester widgets
            for widget_data in semester_data.widgets:
                crud.create_widget(
                    db=db,
                    widget=schemas.WidgetCreate(
                        widget_type=widget_data.widget_type,
                        layout_config=widget_data.layout_config,
                        settings=widget_data.settings,
                        is_removable=widget_data.is_removable
                    ),
                    semester_id=semester.id
                )
            
            # Create semester tabs
            for tab_data in semester_data.tabs:
                crud.create_tab(
                    db=db,
                    tab=schemas.TabCreate(
                        tab_type=tab_data.tab_type,
                        settings=tab_data.settings,
                        order_index=tab_data.order_index,
                        is_removable=tab_data.is_removable,
                        is_draggable=tab_data.is_draggable
                    ),
                    semester_id=semester.id
                )
            
            # Create courses
            for course_data in semester_data.courses:
                course = crud.create_course(
                    db=db,
                    course=schemas.CourseCreate(
                        name=course_data.name,
                        alias=course_data.alias,
                        credits=course_data.credits,
                        grade_percentage=course_data.grade_percentage,
                        grade_scaled=course_data.grade_scaled,
                        include_in_gpa=course_data.include_in_gpa,
                        hide_gpa=course_data.hide_gpa
                    ),
                    program_id=program.id,
                    semester_id=semester.id
                )
                imported_courses += 1
                
                # Create course widgets
                for widget_data in course_data.widgets:
                    crud.create_widget(
                        db=db,
                        widget=schemas.WidgetCreate(
                            widget_type=widget_data.widget_type,
                            layout_config=widget_data.layout_config,
                            settings=widget_data.settings,
                            is_removable=widget_data.is_removable
                        ),
                        course_id=course.id
                    )
                
                # Create course tabs
                for tab_data in course_data.tabs:
                    crud.create_tab(
                        db=db,
                        tab=schemas.TabCreate(
                            tab_type=tab_data.tab_type,
                            settings=tab_data.settings,
                            order_index=tab_data.order_index,
                            is_removable=tab_data.is_removable,
                            is_draggable=tab_data.is_draggable
                        ),
                        course_id=course.id
                    )
    
    for program_data in data.programs:
        name_lower = program_data.name.lower()
        
        if name_lower in existing_names:
            # Conflict detected
            if conflict_mode == "skip":
                skipped_programs += 1
                continue
            elif conflict_mode == "overwrite":
                # Delete existing program first
                existing_program = existing_names[name_lower]
                crud.delete_program(db, program_id=existing_program.id, user_id=current_user.id)
                import_program_data(program_data, program_data.name)
            elif conflict_mode == "rename":
                # Find a unique name
                suffix = 2
                new_name = f"{program_data.name} ({suffix})"
                while new_name.lower() in existing_names:
                    suffix += 1
                    new_name = f"{program_data.name} ({suffix})"
                import_program_data(program_data, new_name)
                # Add to existing names to prevent future conflicts
                existing_names[new_name.lower()] = True
        else:
            # No conflict, just import
            import_program_data(program_data, program_data.name)
            existing_names[name_lower] = True
    
    return {
        "ok": True,
        "conflict_mode": conflict_mode,
        "imported": {
            "programs": imported_programs,
            "semesters": imported_semesters,
            "courses": imported_courses
        },
        "skipped": {
            "programs": skipped_programs
        }
    }

# --- Programs ---
@app.post("/programs/", response_model=schemas.Program)
def create_program(program: schemas.ProgramCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        return crud.create_program(db=db, program=program, user_id=current_user.id)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_TIMEZONE", "Invalid IANA timezone string."),
        )

@app.get("/programs/", response_model=list[schemas.Program])
def read_programs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return crud.get_programs(db, user_id=current_user.id, skip=skip, limit=limit)

@app.get("/programs/{program_id}", response_model=schemas.ProgramWithSemesters)
def read_program(program_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    return program

@app.put("/programs/{program_id}", response_model=schemas.Program)
def update_program(program_id: str, program: schemas.ProgramUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        db_program = crud.update_program(db, program_id=program_id, program_update=program, user_id=current_user.id)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_TIMEZONE", "Invalid IANA timezone string."),
        )
    if not db_program:
        raise HTTPException(status_code=404, detail="Program not found")
    return db_program

@app.delete("/programs/{program_id}")
def delete_program(program_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_program = crud.delete_program(db, program_id=program_id, user_id=current_user.id)
    if not db_program:
        raise HTTPException(status_code=404, detail="Program not found")
    return {"ok": True}

# --- Semesters ---
@app.post("/programs/{program_id}/semesters/", response_model=schemas.Semester)
def create_semester_for_program(
    program_id: str, semester: schemas.SemesterCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    # Verify program ownership
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    if semester.start_date and semester.end_date and semester.start_date > semester.end_date:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_SEMESTER_DATE_RANGE", "start_date must be earlier than or equal to end_date."),
        )
    return crud.create_semester(db=db, semester=semester, program_id=program_id)

@app.post("/programs/{program_id}/semesters/upload", response_model=schemas.Semester)
async def create_semester_from_ics(
    program_id: str, 
    file: UploadFile = File(...), 
    name: str = Form(None), 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    # Verify program ownership
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    content = await file.read()
    parsed_schedule = utils.parse_ics_schedule(content)
    parsed_courses = parsed_schedule.get("courses", [])
    
    if not name:
        name = file.filename.replace(".ics", "")

    start_date = parsed_schedule.get("semesterStartDate") or datetime.utcnow().date()
    end_date = parsed_schedule.get("semesterEndDate") or (start_date + timedelta(days=111))
    if end_date < start_date:
        end_date = start_date

    semester_create = schemas.SemesterCreate(name=name, start_date=start_date, end_date=end_date)
    semester = crud.create_semester(db=db, semester=semester_create, program_id=program_id)
    
    # Create courses and import structured schedule data from ICS.
    user_setting = crud.get_user_setting_dict(current_user)
    default_course_credit = float(user_setting.get("default_course_credit", crud.DEFAULT_COURSE_CREDIT))
    if not parsed_courses:
        parsed_courses = [{"name": course_name, "category": utils.extract_category(course_name), "meetings": []} for course_name in utils.parse_ics(content)]

    for parsed_course in parsed_courses:
        course_name = str(parsed_course.get("name", "")).strip()
        if not course_name:
            continue
        category = parsed_course.get("category") or utils.extract_category(course_name)
        course_create = schemas.CourseCreate(name=course_name, credits=default_course_credit, category=category)
        created_course = crud.create_course(db=db, course=course_create, program_id=program_id, semester_id=semester.id)

        meetings = parsed_course.get("meetings", [])
        if not isinstance(meetings, list) or len(meetings) == 0:
            continue

        try:
            import_course_schedule_from_ics(db, created_course, meetings)
            db.commit()
        except Exception:
            db.rollback()
        
    return semester

@app.get("/semesters/{semester_id}", response_model=schemas.SemesterWithDetails)
def read_semester(semester_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Need to verify ownership via program -> user
    semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if semester is None:
        raise HTTPException(status_code=404, detail="Semester not found")
    return semester

@app.put("/semesters/{semester_id}", response_model=schemas.Semester)
def update_semester(semester_id: str, semester: schemas.SemesterCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Verify ownership
    db_semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    if semester.start_date and semester.end_date and semester.start_date > semester.end_date:
        raise HTTPException(
            status_code=422,
            detail=error_detail("INVALID_SEMESTER_DATE_RANGE", "start_date must be earlier than or equal to end_date."),
        )
    return crud.update_semester(db, semester_id=semester_id, semester_update=semester)

@app.delete("/semesters/{semester_id}")
def delete_semester(semester_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Verify ownership
    db_semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    crud.delete_semester(db, semester_id=semester_id)
    return {"ok": True}

# --- Courses ---
@app.post("/semesters/{semester_id}/courses/", response_model=schemas.Course)
def create_course_for_semester(
    semester_id: str, course: schemas.CourseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    # Verify semester ownership
    semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    return crud.create_course(db=db, course=course, program_id=semester.program_id, semester_id=semester_id)

@app.post("/programs/{program_id}/courses/", response_model=schemas.Course)
def create_course_for_program(
    program_id: str, course: schemas.CourseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return crud.create_course(db=db, course=course, program_id=program_id, semester_id=None)

@app.get("/programs/{program_id}/courses/", response_model=list[schemas.Course])
def read_courses_for_program(
    program_id: str, 
    semester_id: str = None, 
    unassigned: bool = False, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    program = crud.get_program(db, program_id=program_id, user_id=current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return crud.get_courses(db, program_id=program_id, semester_id=semester_id, unassigned=unassigned)

@app.get("/courses/{course_id}", response_model=schemas.CourseWithWidgets)
def read_course(course_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Verify ownership via program -> user
    db_course = db.query(models.Course).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")
    # SQLAlchemy relationships (widgets) are lazy loaded, so pydantic will fetch them if in schema
    return db_course

@app.put("/courses/{course_id}", response_model=schemas.Course)
def update_course(
    course_id: str, course: schemas.CourseUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    # Verify ownership (via program -> user)
    db_course = db.query(models.Course).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    return crud.update_course(db=db, course_id=course_id, course_update=course)

@app.delete("/courses/{course_id}")
def delete_course(
    course_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    db_course = db.query(models.Course).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not db_course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    db.delete(db_course)
    db.commit()
    return {"ok": True}

# --- Event Types ---
@app.get("/courses/{course_id}/event-types", response_model=list[schemas.CourseEventType])
def get_course_event_types(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    ensure_builtin_event_types_for_course(db, course_id)
    db.commit()
    return (
        db.query(models.CourseEventType)
        .filter(models.CourseEventType.course_id == course_id)
        .order_by(models.CourseEventType.code.asc())
        .all()
    )

@app.post("/courses/{course_id}/event-types", response_model=schemas.CourseEventType)
def create_course_event_type(
    course_id: str,
    payload: schemas.CourseEventTypeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    code = payload.code.strip()
    abbreviation = payload.abbreviation.strip()
    if not code:
        raise HTTPException(status_code=422, detail=error_detail("INVALID_EVENT_TYPE_CODE", "code cannot be empty."))
    if not abbreviation:
        raise HTTPException(status_code=422, detail=error_detail("INVALID_EVENT_TYPE_ABBREVIATION", "abbreviation cannot be empty."))

    event_type = models.CourseEventType(
        course_id=course_id,
        code=code,
        abbreviation=abbreviation,
        track_attendance=bool(payload.track_attendance),
        color=payload.color,
        icon=payload.icon,
    )
    touch_model_timestamp(event_type)
    db.add(event_type)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail=error_detail("EVENT_TYPE_DUPLICATE", "Duplicate code or abbreviation for this course."),
        )
    db.refresh(event_type)
    return event_type

@app.patch("/courses/{course_id}/event-types/{event_type_code}", response_model=schemas.CourseEventTypePatchResponse)
def update_course_event_type(
    course_id: str,
    event_type_code: str,
    payload: schemas.CourseEventTypeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    event_type = get_event_type_or_404(db, course_id, event_type_code.strip())
    update_data = payload.dict(exclude_unset=True, by_alias=False)
    normalized_count = 0
    previous_track = bool(event_type.track_attendance)

    if "abbreviation" in update_data and update_data["abbreviation"] is not None:
        update_data["abbreviation"] = update_data["abbreviation"].strip()
        if not update_data["abbreviation"]:
            raise HTTPException(
                status_code=422,
                detail=error_detail("INVALID_EVENT_TYPE_ABBREVIATION", "abbreviation cannot be empty."),
            )

    # Handle code update (event type name)
    old_code = event_type.code
    new_code = None
    if "code" in update_data and update_data["code"] is not None:
        new_code = update_data["code"].strip()
        if not new_code:
            raise HTTPException(
                status_code=422,
                detail=error_detail("INVALID_EVENT_TYPE_CODE", "code cannot be empty."),
            )
        # Check if new code conflicts with existing types (excluding current one)
        if new_code != old_code:
            existing = (
                db.query(models.CourseEventType)
                .filter(
                    models.CourseEventType.course_id == course_id,
                    models.CourseEventType.code == new_code,
                    models.CourseEventType.id != event_type.id,
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=422,
                    detail=error_detail("EVENT_TYPE_DUPLICATE", "code already exists for this course."),
                )

    for key, value in update_data.items():
        setattr(event_type, key, value)

    # If code changed, update all related events and sections
    if new_code and new_code != old_code:
        db.query(models.CourseEvent).filter(
            models.CourseEvent.course_id == course_id,
            models.CourseEvent.event_type_code == old_code,
        ).update({models.CourseEvent.event_type_code: new_code}, synchronize_session=False)
        
        db.query(models.CourseSection).filter(
            models.CourseSection.course_id == course_id,
            models.CourseSection.event_type_code == old_code,
        ).update({models.CourseSection.event_type_code: new_code}, synchronize_session=False)


    if (not previous_track) and event_type.track_attendance:
        normalized_count = (
            db.query(models.CourseEvent)
            .filter(
                models.CourseEvent.course_id == course_id,
                models.CourseEvent.event_type_code == event_type.code,
                models.CourseEvent.skip == True,
            )
            .update({models.CourseEvent.skip: False}, synchronize_session=False)
        )

    touch_model_timestamp(event_type)
    db.add(event_type)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail=error_detail("EVENT_TYPE_DUPLICATE", "Duplicate abbreviation for this course."),
        )
    db.refresh(event_type)
    return {"event_type": event_type, "normalized_events": normalized_count}

@app.delete("/courses/{course_id}/event-types/{event_type_code}")
def delete_course_event_type(
    course_id: str,
    event_type_code: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    event_type = (
        db.query(models.CourseEventType)
        .filter(
            models.CourseEventType.course_id == course_id,
            models.CourseEventType.code == event_type_code.strip(),
        )
        .first()
    )
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found")
    db.delete(event_type)
    db.commit()
    return {"ok": True}

# --- Sections ---
@app.get("/courses/{course_id}/sections", response_model=list[schemas.CourseSection])
def get_course_sections(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    return (
        db.query(models.CourseSection)
        .filter(models.CourseSection.course_id == course_id)
        .order_by(models.CourseSection.day_of_week.asc(), models.CourseSection.start_time.asc())
        .all()
    )

def validate_section_payload(course_id: str, payload: dict, db: Session):
    section_id = payload.get("section_id")
    if section_id is not None:
        validate_section_id(section_id)
    payload["event_type_code"] = payload["event_type_code"].strip()
    payload["week_pattern"] = normalize_week_pattern_input(payload["week_pattern"])
    validate_day_of_week(payload["day_of_week"])
    validate_time_range(payload["start_time"], payload["end_time"])
    validate_week_range(payload["start_week"], payload["end_week"], "SECTION")
    get_event_type_or_404(db, course_id, payload["event_type_code"])

@app.post("/courses/{course_id}/sections", response_model=schemas.CourseSection)
def create_course_section(
    course_id: str,
    section: schemas.CourseSectionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    ensure_builtin_event_types_for_course(db, course_id)
    payload = section.dict(by_alias=False)
    payload["section_id"] = payload["section_id"].strip()
    if not payload["section_id"]:
        raise HTTPException(status_code=422, detail=error_detail("INVALID_SECTION_ID", "sectionId cannot be empty."))
    validate_section_payload(course_id, payload, db)

    db_section = models.CourseSection(course_id=course_id, **payload)
    touch_model_timestamp(db_section)
    db.add(db_section)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=422, detail=error_detail("SECTION_DUPLICATE", "sectionId must be unique within course."))
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail=error_detail("SECTION_CREATE_FAILED", f"Failed to create section: {str(exc)}"),
        ) from exc
    db.refresh(db_section)
    return db_section

@app.patch("/courses/{course_id}/sections/{section_id}", response_model=schemas.CourseSection)
def update_course_section(
    course_id: str,
    section_id: str,
    section_update: schemas.CourseSectionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    db_section = (
        db.query(models.CourseSection)
        .filter(models.CourseSection.course_id == course_id, models.CourseSection.section_id == section_id)
        .first()
    )
    if not db_section:
        raise HTTPException(status_code=404, detail="Section not found")

    update_data = section_update.dict(exclude_unset=True, by_alias=False)
    merged = {
        "event_type_code": update_data.get("event_type_code", db_section.event_type_code),
        "day_of_week": update_data.get("day_of_week", db_section.day_of_week),
        "start_time": update_data.get("start_time", db_section.start_time),
        "end_time": update_data.get("end_time", db_section.end_time),
        "week_pattern": update_data.get("week_pattern", db_section.week_pattern),
        "start_week": update_data.get("start_week", db_section.start_week),
        "end_week": update_data.get("end_week", db_section.end_week),
    }
    validate_section_payload(course_id, merged, db)

    for key, value in update_data.items():
        if key == "event_type_code" and value is not None:
            value = value.strip()
        if key == "week_pattern" and value is not None:
            value = normalize_week_pattern_input(value)
        setattr(db_section, key, value)

    touch_model_timestamp(db_section)
    db.add(db_section)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=422, detail=error_detail("SECTION_UPDATE_CONFLICT", "Failed to update section due to constraint conflict."))
    db.refresh(db_section)
    return db_section

@app.delete("/courses/{course_id}/sections/{section_id}")
def delete_course_section(
    course_id: str,
    section_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    db_section = (
        db.query(models.CourseSection)
        .filter(models.CourseSection.course_id == course_id, models.CourseSection.section_id == section_id)
        .first()
    )
    if not db_section:
        raise HTTPException(status_code=404, detail="Section not found")
    db.delete(db_section)
    db.commit()
    return {"ok": True}

@app.post("/courses/{course_id}/sections/import", response_model=list[schemas.CourseSection])
def import_course_sections(
    course_id: str,
    payload: schemas.CourseSectionImportRequest,
    mode: str = Query("merge"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    if mode not in {"merge", "replace"}:
        raise HTTPException(status_code=422, detail=error_detail("INVALID_IMPORT_MODE", "mode must be merge or replace."))

    try:
        if mode == "replace":
            db.query(models.CourseSection).filter(models.CourseSection.course_id == course_id).delete(synchronize_session=False)

        for item in payload.items:
            item_payload = item.dict(by_alias=False)
            item_payload["section_id"] = item_payload["section_id"].strip()
            if not item_payload["section_id"]:
                raise HTTPException(status_code=422, detail=error_detail("INVALID_SECTION_ID", "sectionId cannot be empty."))
            validate_section_payload(course_id, item_payload, db)
            db_section = models.CourseSection(course_id=course_id, **item_payload)
            touch_model_timestamp(db_section)
            db.add(db_section)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=422, detail=error_detail("SECTION_IMPORT_CONFLICT", "Section import failed due to duplicate values."))

    return (
        db.query(models.CourseSection)
        .filter(models.CourseSection.course_id == course_id)
        .order_by(models.CourseSection.day_of_week.asc(), models.CourseSection.start_time.asc())
        .all()
    )

# --- Events ---
def validate_event_payload(course_id: str, payload: dict, db: Session):
    payload["event_type_code"] = payload["event_type_code"].strip()
    payload["week_pattern"] = normalize_week_pattern_input(payload["week_pattern"])
    validate_day_of_week(payload["day_of_week"])
    validate_time_range(payload["start_time"], payload["end_time"])
    validate_week_range(payload.get("start_week"), payload.get("end_week"), "EVENT")
    get_event_type_or_404(db, course_id, payload["event_type_code"])

    section = get_section_or_422(db, course_id, payload.get("section_id"))
    if section and section.event_type_code != payload["event_type_code"]:
        raise HTTPException(
            status_code=422,
            detail=error_detail("SECTION_EVENT_TYPE_MISMATCH", "sectionId does not match eventTypeCode."),
        )

    payload["skip"] = normalize_event_skip(db, course_id, payload["event_type_code"], bool(payload.get("skip", False)))

@app.get("/courses/{course_id}/events", response_model=list[schemas.CourseEvent])
def get_course_events(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    return (
        db.query(models.CourseEvent)
        .filter(models.CourseEvent.course_id == course_id)
        .order_by(models.CourseEvent.day_of_week.asc(), models.CourseEvent.start_time.asc())
        .all()
    )

def _create_course_event_record(
    course_id: str,
    payload: schemas.CourseEventCreate,
    db: Session,
    auto_commit: bool = True,
) -> models.CourseEvent:
    ensure_builtin_event_types_for_course(db, course_id)
    event_payload = payload.dict(by_alias=False)
    validate_event_payload(course_id, event_payload, db)
    db_event = models.CourseEvent(course_id=course_id, **event_payload)
    touch_model_timestamp(db_event)
    db.add(db_event)
    try:
        if auto_commit:
            db.commit()
        else:
            db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=422, detail=error_detail("EVENT_CREATE_CONFLICT", "Event create failed due to constraint conflict."))
    db.refresh(db_event)
    return db_event

@app.post("/courses/{course_id}/events", response_model=schemas.CourseEvent)
def create_course_event(
    course_id: str,
    payload: schemas.CourseEventCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    return _create_course_event_record(course_id, payload, db, auto_commit=True)

def _update_course_event_record(
    course_id: str,
    event_id: str,
    payload: schemas.CourseEventUpdate,
    db: Session,
    auto_commit: bool = True,
) -> models.CourseEvent:
    db_event = (
        db.query(models.CourseEvent)
        .filter(models.CourseEvent.id == event_id, models.CourseEvent.course_id == course_id)
        .first()
    )
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = payload.dict(exclude_unset=True, by_alias=False)
    merged_payload = {
        "event_type_code": update_data.get("event_type_code", db_event.event_type_code),
        "section_id": update_data.get("section_id", db_event.section_id),
        "day_of_week": update_data.get("day_of_week", db_event.day_of_week),
        "start_time": update_data.get("start_time", db_event.start_time),
        "end_time": update_data.get("end_time", db_event.end_time),
        "week_pattern": update_data.get("week_pattern", db_event.week_pattern),
        "start_week": update_data.get("start_week", db_event.start_week),
        "end_week": update_data.get("end_week", db_event.end_week),
        "skip": update_data.get("skip", db_event.skip),
    }
    validate_event_payload(course_id, merged_payload, db)

    for key, value in update_data.items():
        if key == "event_type_code" and value is not None:
            value = value.strip().upper()
        if key == "week_pattern" and value is not None:
            value = normalize_week_pattern_input(value)
        setattr(db_event, key, value)

    db_event.skip = merged_payload["skip"]
    touch_model_timestamp(db_event)
    db.add(db_event)
    try:
        if auto_commit:
            db.commit()
        else:
            db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=422, detail=error_detail("EVENT_UPDATE_CONFLICT", "Event update failed due to constraint conflict."))
    db.refresh(db_event)
    return db_event

@app.patch("/courses/{course_id}/events/{event_id}", response_model=schemas.CourseEvent)
def update_course_event(
    course_id: str,
    event_id: str,
    payload: schemas.CourseEventUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    return _update_course_event_record(course_id, event_id, payload, db, auto_commit=True)

def _delete_course_event_record(
    course_id: str,
    event_id: str,
    db: Session,
    auto_commit: bool = True,
) -> None:
    db_event = (
        db.query(models.CourseEvent)
        .filter(models.CourseEvent.id == event_id, models.CourseEvent.course_id == course_id)
        .first()
    )
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(db_event)
    if auto_commit:
        db.commit()
    else:
        db.flush()

@app.delete("/courses/{course_id}/events/{event_id}")
def delete_course_event(
    course_id: str,
    event_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)
    _delete_course_event_record(course_id, event_id, db, auto_commit=True)
    return {"ok": True}

def _batch_error_payload(exc: HTTPException) -> dict:
    detail = exc.detail
    if isinstance(detail, dict):
        return {
            "code": detail.get("code", "BATCH_ITEM_FAILED"),
            "message": detail.get("message", "Batch item failed."),
        }
    return {"code": "BATCH_ITEM_FAILED", "message": str(detail)}

def _apply_batch_item(
    course_id: str,
    item: schemas.CourseEventBatchItem,
    db: Session,
    current_user: models.User,
    auto_commit: bool,
) -> Optional[models.CourseEvent]:
    if item.op == "create":
        if item.data is None:
            raise HTTPException(status_code=422, detail=error_detail("INVALID_BATCH_ITEM", "create operation requires data."))
        payload = schemas.CourseEventCreate.model_validate(item.data)
        return _create_course_event_record(course_id, payload, db, auto_commit=auto_commit)

    if item.op == "update":
        if not item.event_id:
            raise HTTPException(status_code=422, detail=error_detail("INVALID_BATCH_ITEM", "update operation requires eventId."))
        if item.data is None:
            raise HTTPException(status_code=422, detail=error_detail("INVALID_BATCH_ITEM", "update operation requires data."))
        payload = schemas.CourseEventUpdate.model_validate(item.data)
        return _update_course_event_record(course_id, item.event_id, payload, db, auto_commit=auto_commit)

    if item.op == "delete":
        if not item.event_id:
            raise HTTPException(status_code=422, detail=error_detail("INVALID_BATCH_ITEM", "delete operation requires eventId."))
        _delete_course_event_record(course_id, item.event_id, db, auto_commit=auto_commit)
        return None

    raise HTTPException(status_code=422, detail=error_detail("INVALID_BATCH_ITEM", f"Unsupported op '{item.op}'."))

@app.post("/courses/{course_id}/events/batch", response_model=schemas.CourseEventBatchResponse)
def batch_course_events(
    course_id: str,
    payload: schemas.CourseEventBatchRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    get_owned_course(db, current_user, course_id)

    if payload.atomic:
        results: list[dict] = []
        try:
            for index, item in enumerate(payload.items):
                event = _apply_batch_item(course_id, item, db, current_user, auto_commit=False)
                result = {"index": index, "ok": True}
                if event is not None:
                    result["event"] = event
                results.append(result)
            db.commit()
        except HTTPException as exc:
            db.rollback()
            err = _batch_error_payload(exc)
            raise HTTPException(
                status_code=422,
                detail={"failedIndex": index, **err},
            )
        return {
            "atomic": True,
            "total": len(payload.items),
            "succeeded": len(results),
            "failed": 0,
            "results": results,
        }

    results: list[dict] = []
    succeeded = 0
    failed = 0
    for index, item in enumerate(payload.items):
        try:
            event = _apply_batch_item(course_id, item, db, current_user, auto_commit=True)
            entry = {"index": index, "ok": True}
            if event is not None:
                entry["event"] = event
            results.append(entry)
            succeeded += 1
        except HTTPException as exc:
            db.rollback()
            results.append(
                {
                    "index": index,
                    "ok": False,
                    "error": _batch_error_payload(exc),
                }
            )
            failed += 1

    return {
        "atomic": False,
        "total": len(payload.items),
        "succeeded": succeeded,
        "failed": failed,
        "results": results,
    }

# --- Schedule ---
@app.get("/schedule/course/{course_id}", response_model=schemas.ScheduleResponse)
def get_course_schedule(
    course_id: str,
    week: Optional[int] = None,
    with_conflicts: bool = Query(True, alias="withConflicts"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    course, semester, timezone = get_course_semester_and_timezone(db, current_user, course_id)
    resolved_week = resolve_week_index(semester, timezone, week)
    max_week = get_semester_max_week(semester)
    items, warnings = collect_course_week_items(db, course, semester, resolved_week)
    if with_conflicts:
        items = detect_conflicts(items)
    serialized = [serialize_schedule_item(item) for item in items]
    return {
        "week": resolved_week,
        "maxWeek": max_week,
        "items": serialized,
        "warnings": warnings,
    }

@app.get("/schedule/semester/{semester_id}", response_model=schemas.ScheduleResponse)
def get_semester_schedule(
    semester_id: str,
    week: Optional[int] = None,
    with_conflicts: bool = Query(True, alias="withConflicts"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    semester = get_owned_semester(db, current_user, semester_id)
    program = crud.get_program(db, semester.program_id, current_user.id)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    timezone = (program.program_timezone or "UTC").strip() or "UTC"

    resolved_week = resolve_week_index(semester, timezone, week)
    max_week = get_semester_max_week(semester)
    items, warnings = collect_semester_week_items(db, semester, resolved_week)
    if with_conflicts:
        items = detect_conflicts(items)
    serialized = [serialize_schedule_item(item) for item in items]
    return {
        "week": resolved_week,
        "maxWeek": max_week,
        "items": serialized,
        "warnings": warnings,
    }

def collect_export_items_for_week(
    scope: schemas.ExportScope,
    scope_id: str,
    week: int,
    db: Session,
    current_user: models.User,
) -> tuple[list[dict], models.Semester]:
    if scope == schemas.ExportScope.COURSE:
        course, semester, _timezone = get_course_semester_and_timezone(db, current_user, scope_id)
        items, _warnings = collect_course_week_items(db, course, semester, week)
        return detect_conflicts(items), semester

    semester = get_owned_semester(db, current_user, scope_id)
    items, _warnings = collect_semester_week_items(db, semester, week)
    return detect_conflicts(items), semester

def build_export_payload(
    request: schemas.ScheduleExportRequest,
    export_format: str,
    db: Session,
    current_user: models.User,
) -> dict:
    if request.scope == schemas.ExportScope.COURSE:
        _course, semester, timezone = get_course_semester_and_timezone(db, current_user, request.scope_id)
    else:
        semester = get_owned_semester(db, current_user, request.scope_id)
        program = crud.get_program(db, semester.program_id, current_user.id)
        if not program:
            raise HTTPException(status_code=404, detail="Program not found")
        timezone = (program.program_timezone or "UTC").strip() or "UTC"

    weeks = parse_export_weeks(
        request.range,
        request.week,
        request.start_week,
        request.end_week,
        semester,
        timezone,
    )

    merged_items: list[dict] = []
    for week in weeks:
        week_items, _semester = collect_export_items_for_week(request.scope, request.scope_id, week, db, current_user)
        for item in week_items:
            if item["skip"]:
                if export_format == "ics":
                    continue
                if request.skip_render_mode == schemas.SkipRenderMode.HIDE_SKIPPED:
                    continue
                item["render_state"] = "SKIPPED_GRAY"
            else:
                item["render_state"] = "NORMAL"
            merged_items.append(item)

    return {
        "semester": semester,
        "weeks": weeks,
        "items": merged_items,
    }

@app.post("/schedule/export/png", response_model=schemas.JsonExportResponse)
def export_schedule_png(
    request: schemas.ScheduleExportRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    payload = build_export_payload(request, "png", db, current_user)
    serialized = [serialize_schedule_item(item, include_render_state=True) for item in payload["items"]]
    return {
        "format": "png",
        "scope": request.scope,
        "scopeId": request.scope_id,
        "weeks": payload["weeks"],
        "itemCount": len(serialized),
        "skipRenderMode": request.skip_render_mode,
        "items": serialized,
    }

@app.post("/schedule/export/pdf", response_model=schemas.JsonExportResponse)
def export_schedule_pdf(
    request: schemas.ScheduleExportRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    payload = build_export_payload(request, "pdf", db, current_user)
    serialized = [serialize_schedule_item(item, include_render_state=True) for item in payload["items"]]
    return {
        "format": "pdf",
        "scope": request.scope,
        "scopeId": request.scope_id,
        "weeks": payload["weeks"],
        "itemCount": len(serialized),
        "skipRenderMode": request.skip_render_mode,
        "items": serialized,
    }

@app.post("/schedule/export/ics")
def export_schedule_ics(
    request: schemas.ScheduleExportRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    payload = build_export_payload(request, "ics", db, current_user)
    semester = payload["semester"]

    calendar = Calendar()
    calendar.add("prodid", "-//Semestra//Schedule Export//EN")
    calendar.add("version", "2.0")

    for item in payload["items"]:
        event_date = week_date(semester.start_date, item["week"], item["day_of_week"])
        dtstart = datetime.combine(event_date, parse_time_value(item["start_time"]))
        dtend = datetime.combine(event_date, parse_time_value(item["end_time"]))

        ical_event = ICalEvent()
        ical_event.add("uid", f"{item['event_id']}-{item['week']}@semestra")
        ical_event.add("summary", f"{item['course_name']} {item['event_type_code']}")
        ical_event.add("dtstart", dtstart)
        ical_event.add("dtend", dtend)
        if item.get("note"):
            ical_event.add("description", item["note"])
        calendar.add_component(ical_event)

    filename = f"schedule-{request.scope.value}-{request.scope_id}.ics"
    return Response(
        content=calendar.to_ical(),
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

# --- Widgets ---
@app.post("/semesters/{semester_id}/widgets/", response_model=schemas.Widget)
def create_widget_for_semester(
    semester_id: str, widget: schemas.WidgetCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    return crud.create_widget(db=db, widget=widget, semester_id=semester_id)

@app.post("/courses/{course_id}/widgets/", response_model=schemas.Widget)
def create_widget_for_course(
    course_id: str, widget: schemas.WidgetCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    course = db.query(models.Course).join(models.Semester).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return crud.create_widget(db=db, widget=widget, course_id=course_id)

@app.put("/widgets/{widget_id}", response_model=schemas.Widget)
def update_widget(
    widget_id: str, widget: schemas.WidgetUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    # Verify ownership via semester -> program -> user OR course -> semester -> program -> user
    # Check Semester widget
    db_widget_sem = db.query(models.Widget).join(models.Semester).join(models.Program).filter(
        models.Widget.id == widget_id, models.Program.owner_id == current_user.id
    ).first()
    
    # Check Course widget
    db_widget_course = db.query(models.Widget).join(models.Course).join(models.Semester).join(models.Program).filter(
        models.Widget.id == widget_id, models.Program.owner_id == current_user.id
    ).first()

    db_widget = db_widget_sem or db_widget_course

    if not db_widget:
        raise HTTPException(status_code=404, detail="Widget not found")
    return crud.update_widget(db=db, widget_id=widget_id, widget_update=widget)

@app.delete("/widgets/{widget_id}")
def delete_widget(
    widget_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    # Check Semester widget
    db_widget_sem = db.query(models.Widget).join(models.Semester).join(models.Program).filter(
        models.Widget.id == widget_id, models.Program.owner_id == current_user.id
    ).first()
    
    # Check Course widget
    db_widget_course = db.query(models.Widget).join(models.Course).join(models.Semester).join(models.Program).filter(
        models.Widget.id == widget_id, models.Program.owner_id == current_user.id
    ).first()

    db_widget = db_widget_sem or db_widget_course

    if not db_widget:
        raise HTTPException(status_code=404, detail="Widget not found")
        
    if db_widget.is_removable is False:
        raise HTTPException(status_code=400, detail="Cannot delete this widget")
        
    return crud.delete_widget(db=db, widget_id=widget_id)

# --- Tabs ---
@app.post("/semesters/{semester_id}/tabs/", response_model=schemas.Tab)
def create_tab_for_semester(
    semester_id: str, tab: schemas.TabCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    semester = db.query(models.Semester).join(models.Program).filter(
        models.Semester.id == semester_id, models.Program.owner_id == current_user.id
    ).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    return crud.create_tab(db=db, tab=tab, semester_id=semester_id)

@app.post("/courses/{course_id}/tabs/", response_model=schemas.Tab)
def create_tab_for_course(
    course_id: str, tab: schemas.TabCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    course = db.query(models.Course).join(models.Semester).join(models.Program).filter(
        models.Course.id == course_id, models.Program.owner_id == current_user.id
    ).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return crud.create_tab(db=db, tab=tab, course_id=course_id)

@app.put("/tabs/{tab_id}", response_model=schemas.Tab)
def update_tab(
    tab_id: str, tab: schemas.TabUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    db_tab_sem = db.query(models.Tab).join(models.Semester).join(models.Program).filter(
        models.Tab.id == tab_id, models.Program.owner_id == current_user.id
    ).first()
    db_tab_course = db.query(models.Tab).join(models.Course).join(models.Semester).join(models.Program).filter(
        models.Tab.id == tab_id, models.Program.owner_id == current_user.id
    ).first()
    db_tab = db_tab_sem or db_tab_course
    if not db_tab:
        raise HTTPException(status_code=404, detail="Tab not found")
    return crud.update_tab(db=db, tab_id=tab_id, tab_update=tab)

@app.delete("/tabs/{tab_id}")
def delete_tab(
    tab_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)
):
    db_tab_sem = db.query(models.Tab).join(models.Semester).join(models.Program).filter(
        models.Tab.id == tab_id, models.Program.owner_id == current_user.id
    ).first()
    db_tab_course = db.query(models.Tab).join(models.Course).join(models.Semester).join(models.Program).filter(
        models.Tab.id == tab_id, models.Program.owner_id == current_user.id
    ).first()
    db_tab = db_tab_sem or db_tab_course
    if not db_tab:
        raise HTTPException(status_code=404, detail="Tab not found")
    if db_tab.is_removable is False:
        raise HTTPException(status_code=400, detail="Cannot delete this tab")
    return crud.delete_tab(db, tab_id=tab_id)

@app.get("/")
def read_root():
    return {"message": "Semestra API Running"}
