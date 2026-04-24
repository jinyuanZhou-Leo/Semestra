# input:  [SQLAlchemy session, models, schemas, shared color helpers, timezone/date helpers, and transaction helpers]
# output: [shared CRUD constants, exceptions, user/settings helpers, auth password hashing helpers, normalization helpers, race-safe user identity persistence helpers, active-Program normalization helpers with lightweight Program lookups, and common serialization utilities]
# pos:    [Shared foundation for backend CRUD modules so Program/plugin/semester/course/layout operations can reuse one coherent helper layer, including normalized user creation, Google identity linking, credential updates, and active-Program repair for both read and write paths]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

import bcrypt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, object_session

from color_utils import (
    parse_subject_color_map,
    resolve_subject_code,
    resolve_subject_color_assignments,
    serialize_subject_color_map,
)

import models
import logic
import plugin_registry
import schemas

DEFAULT_GPA_SCALING = '{"90-100": 4.0, "85-89": 4.0, "80-84": 3.7, "77-79": 3.3, "73-76": 3.0, "70-72": 2.7, "67-69": 2.3, "63-66": 2.0, "60-62": 1.7, "57-59": 1.3, "53-56": 1.0, "50-52": 0.7, "0-49": 0}'
DEFAULT_COURSE_CREDIT = 0.5
DEFAULT_PROGRAM_TIMEZONE = "UTC"
DEFAULT_SEMESTER_LENGTH_DAYS = 111
LEGACY_TAB_TYPE_ALIASES = {
    "dashboard": "builtin-dashboard",
    "settings": "builtin-setting",
    "builtin-settings": "builtin-setting",
}
BUILTIN_EVENT_TYPES = [
    {"code": "LECTURE", "abbreviation": "LEC"},
    {"code": "TUTORIAL", "abbreviation": "TUT"},
    {"code": "PRACTICAL", "abbreviation": "PRA"},
]


class ProgramLmsDependencyError(Exception):
    pass


class CourseSemesterAssignmentError(Exception):
    pass


class PluginRegistryError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


UserIdentityField = Literal["email", "google_sub"]


class UserIdentityConflictError(Exception):
    def __init__(self, field: UserIdentityField):
        super().__init__(field)
        self.field = field


def _now_utc_iso() -> str:
    return datetime.now(UTC).isoformat()


def _parse_json_object(raw_value: str | None) -> dict:
    if not raw_value:
        return {}
    try:
        parsed = json.loads(raw_value)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _serialize_json_object(value: dict | None) -> str:
    return json.dumps(value or {}, sort_keys=True)


def normalize_user_email(email: str | None) -> str:
    return str(email or "").strip().lower()


def _classify_user_identity_integrity_error(exc: IntegrityError) -> UserIdentityField | None:
    error_message = str(getattr(exc, "orig", exc)).lower()
    if "google_sub" in error_message:
        return "google_sub"
    if "email" in error_message:
        return "email"
    return None


def _commit_user_identity_row(db: Session, user: models.User) -> models.User:
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        conflict_field = _classify_user_identity_integrity_error(exc)
        if conflict_field is not None:
            raise UserIdentityConflictError(conflict_field) from exc
        raise
    db.refresh(user)
    return user


def _canonical_plugin_id(plugin_id: str) -> str:
    return plugin_registry.normalize_plugin_id(plugin_id)


def _canonical_tab_type(tab_type: str | None) -> str:
    value = str(tab_type or "").strip()
    return LEGACY_TAB_TYPE_ALIASES.get(value, value)


def _wrap_plugin_validation(exc: Exception) -> None:
    if isinstance(exc, plugin_registry.PluginRegistryValidationError):
        raise PluginRegistryError(exc.code, exc.message) from exc
    raise exc


def _build_review_issue(
    *,
    code: str,
    message: str,
    step: str,
    plugin_id: str | None = None,
    field_path: str | None = None,
) -> dict:
    return {
        "code": code,
        "message": message,
        "step": step,
        "plugin_id": plugin_id,
        "field_path": field_path,
    }


def _validate_reading_week(
    *,
    semester_start: date,
    semester_end: date,
    reading_week_start: date | None,
    reading_week_end: date | None,
) -> list[dict]:
    if reading_week_start is None and reading_week_end is None:
        return []
    if reading_week_start is None or reading_week_end is None:
        return [_build_review_issue(
            code="INVALID_READING_WEEK_RANGE",
            message="reading_week_start and reading_week_end must both be provided.",
            step="basics",
        )]
    if reading_week_start > reading_week_end:
        return [_build_review_issue(
            code="INVALID_READING_WEEK_RANGE",
            message="reading_week_start must be earlier than or equal to reading_week_end.",
            step="basics",
        )]
    if (reading_week_end - reading_week_start).days != 6:
        return [_build_review_issue(
            code="INVALID_READING_WEEK_SPAN",
            message="Reading Week must span exactly 7 days.",
            step="basics",
        )]
    if reading_week_start.isoweekday() != 1 or reading_week_end.isoweekday() != 7:
        return [_build_review_issue(
            code="INVALID_READING_WEEK_ALIGNMENT",
            message="Reading Week must start on Monday and end on Sunday.",
            step="basics",
        )]
    if reading_week_start < semester_start or reading_week_end > semester_end:
        return [_build_review_issue(
            code="INVALID_READING_WEEK_RANGE",
            message="Reading Week must fall within the semester date range.",
            step="basics",
        )]
    return []


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
        "background_plugin_preload": True,
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

    background_plugin_preload = normalized.get("background_plugin_preload")
    if isinstance(background_plugin_preload, bool):
        normalized["background_plugin_preload"] = background_plugin_preload
    else:
        normalized["background_plugin_preload"] = True

    return normalized


def get_user_setting_dict(user: models.User | None) -> dict:
    settings = parse_user_setting(getattr(user, "user_setting", None)) if user else {}
    return normalize_user_setting_dict(settings)


def set_user_setting_dict(db: Session, user: models.User, settings: dict, *, commit: bool = True) -> models.User:
    managed_user = user if object_session(user) is db else db.merge(user)
    managed_user.user_setting = _serialize_json_object(normalize_user_setting_dict(settings))
    db.add(managed_user)
    if commit:
        db.commit()
        db.refresh(managed_user)
    return managed_user


def ensure_user_active_program(db: Session, user: models.User, *, commit: bool = True) -> models.User:
    managed_user = user if object_session(user) is db else db.merge(user)
    settings = get_user_setting_dict(managed_user)
    active_program_id = settings.get("active_program_id")
    program_rows = (
        db.query(models.Program)
        .with_entities(models.Program.id, models.Program.name)
        .filter(models.Program.owner_id == managed_user.id)
        .order_by(models.Program.name.asc(), models.Program.id.asc())
        .all()
    )
    valid_program_ids = {program_id for program_id, _program_name in program_rows}

    next_active_program_id: str | None
    if not program_rows:
        next_active_program_id = None
    elif isinstance(active_program_id, str) and active_program_id in valid_program_ids:
        next_active_program_id = active_program_id
    else:
        next_active_program_id = program_rows[0][0]

    if settings.get("active_program_id") == next_active_program_id:
        return managed_user

    settings["active_program_id"] = next_active_program_id
    return set_user_setting_dict(db, managed_user, settings, commit=commit)


def _sync_program_subject_color_map(program: models.Program) -> bool:
    discovered_subject_codes = [
        resolve_subject_code(category=course.category, alias=course.alias, name=course.name)
        for course in program.courses
    ]
    persisted_assignments = parse_subject_color_map(program.subject_color_map)
    resolved_assignments = resolve_subject_color_assignments(discovered_subject_codes, persisted_assignments)
    next_assignments = dict(persisted_assignments)
    next_assignments.update(resolved_assignments)
    serialized_assignments = serialize_subject_color_map(next_assignments)
    if serialized_assignments == (program.subject_color_map or "{}"):
        return False
    program.subject_color_map = serialized_assignments
    return True


def verify_password(plain_password, hashed_password):
    if not hashed_password:
        return False
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def get_user(db: Session, user_id: str):
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_email(db: Session, email: str):
    normalized_email = normalize_user_email(email)
    if not normalized_email:
        return None
    return db.query(models.User).filter(models.User.email == normalized_email).first()


def get_user_by_google_sub(db: Session, google_sub: str):
    return db.query(models.User).filter(models.User.google_sub == google_sub).first()


def create_user(db: Session, user: schemas.UserCreate, *, email_verified_at: str | None = None):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        email=normalize_user_email(user.email),
        nickname=user.nickname,
        hashed_password=hashed_password,
        email_verified_at=email_verified_at,
        user_setting=json.dumps(get_default_user_setting_dict()),
    )
    return _commit_user_identity_row(db, db_user)


def create_user_from_google(db: Session, email: str, google_sub: str, *, email_verified_at: str | None = None):
    db_user = models.User(
        email=normalize_user_email(email),
        hashed_password=None,
        google_sub=google_sub,
        email_verified_at=email_verified_at,
        user_setting=json.dumps(get_default_user_setting_dict()),
    )
    return _commit_user_identity_row(db, db_user)


def link_google_account_to_user(
    db: Session,
    user: models.User,
    *,
    google_sub: str,
    email_verified_at: str | None = None,
) -> models.User:
    user.google_sub = google_sub
    if email_verified_at and not user.email_verified_at:
        user.email_verified_at = email_verified_at
    return _commit_user_identity_row(db, user)


def update_user_password(db: Session, user: models.User, new_password: str) -> models.User:
    user.hashed_password = get_password_hash(new_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: str, user_update: schemas.UserUpdate):
    db_user = get_user(db, user_id)
    if not db_user:
        return None

    update_data = user_update.model_dump(exclude_unset=True)

    if "nickname" in update_data:
        db_user.nickname = update_data["nickname"]

    previous_settings = get_user_setting_dict(db_user)
    previous_gpa_table = previous_settings.get("gpa_scaling_table")
    merged_settings = dict(previous_settings)
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

    if "background_plugin_preload" in update_data and update_data["background_plugin_preload"] is not None:
        merged_settings["background_plugin_preload"] = bool(update_data["background_plugin_preload"])
        has_settings_update = True

    merged_settings = normalize_user_setting_dict(merged_settings)
    gpa_table_changed = has_settings_update and previous_gpa_table != merged_settings.get("gpa_scaling_table")

    if has_settings_update or not db_user.user_setting:
        db_user.user_setting = json.dumps(merged_settings)

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    if gpa_table_changed:
        programs = db.query(models.Program).filter(models.Program.owner_id == user_id).all()
        for program in programs:
            if parse_user_setting(program.gpa_scaling_table):
                continue
            logic.recalculate_all_stats(program, db)
    return db_user
