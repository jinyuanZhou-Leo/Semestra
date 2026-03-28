# input:  [SQLAlchemy session, models, schemas, shared color helpers, timezone/date helpers, plugin governance registry helpers, and transaction/integrity helpers]
# output: [CRUD functions for users, tasks, courses, widgets, plugin-shared settings, Program-level plugin governance rows, manifest-backed plugin-system setup flows, Semester draft lifecycle flows with transactional draft initialization plus database-backed single-draft enforcement, Program-enabled-plus-Semester-state plugin activation payloads, legacy homepage-tab normalization helpers, user settings including background plugin preload preference defaults, gradebook initialization, validated course-to-semester reassignment, stable Program subject-color synchronization, and Program-plugin uninstall cleanup for plugin-owned runtime data]
# pos:    [Database access layer for backend services, normalized user-setting persistence, Program plugin governance, manifest-backed Semester plugin setup state, transactional Semester draft creation plus Program-enabled plugin visibility and activation state, legacy tab-type cleanup, gradebook-backed course creation, Program-plugin uninstall cleanup, and stat-safe course/semester mutations]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
import json
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo
from color_utils import parse_subject_color_map, resolve_subject_code, resolve_subject_color_assignments, serialize_subject_color_map
import models
import schemas
import bcrypt
import gradebook
import plugin_governance

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


class PluginGovernanceError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


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


def _canonical_plugin_id(plugin_id: str) -> str:
    return plugin_governance.normalize_plugin_id(plugin_id)


def _canonical_tab_type(tab_type: str | None) -> str:
    value = str(tab_type or "").strip()
    return LEGACY_TAB_TYPE_ALIASES.get(value, value)


def _normalize_context_tabs(
    db: Session,
    *,
    semester: models.Semester | None = None,
    course: models.Course | None = None,
    commit: bool = True,
) -> None:
    tabs = list(semester.tabs if semester is not None else course.tabs if course is not None else [])
    tabs_by_type: dict[str, models.Tab] = {
        tab.tab_type: tab
        for tab in tabs
        if tab.tab_type == _canonical_tab_type(tab.tab_type)
    }
    did_change = False

    for tab in sorted(tabs, key=lambda item: (int(item.order_index or 0), item.id or "")):
        canonical_tab_type = _canonical_tab_type(tab.tab_type)
        if canonical_tab_type == tab.tab_type:
            continue

        canonical_tab = tabs_by_type.get(canonical_tab_type)
        if canonical_tab is None:
            tab.tab_type = canonical_tab_type
            tabs_by_type[canonical_tab_type] = tab
            db.add(tab)
            did_change = True
            continue

        if canonical_tab.settings in {"", "{}"} and tab.settings not in {"", "{}"}:
            canonical_tab.settings = tab.settings
        canonical_tab.order_index = min(int(canonical_tab.order_index or 0), int(tab.order_index or 0))
        canonical_tab.is_removable = bool(canonical_tab.is_removable and tab.is_removable)
        canonical_tab.is_draggable = bool(canonical_tab.is_draggable and tab.is_draggable)
        db.add(canonical_tab)
        db.delete(tab)
        did_change = True

    if did_change:
        if commit:
            db.commit()
            if semester is not None:
                db.refresh(semester)
            if course is not None:
                db.refresh(course)
        else:
            db.flush()


def _normalize_program_plugin_installations(
    db: Session,
    program: models.Program,
    *,
    commit: bool = True,
) -> None:
    installations = list(program.plugin_installations)
    installations_by_plugin_id: dict[str, models.ProgramPluginInstallation] = {
        installation.plugin_id: installation
        for installation in installations
        if installation.plugin_id == _canonical_plugin_id(installation.plugin_id)
    }
    did_change = False

    for installation in sorted(installations, key=lambda item: item.created_at or ""):
        canonical_plugin_id = _canonical_plugin_id(installation.plugin_id)
        if canonical_plugin_id == installation.plugin_id:
            continue

        canonical_installation = installations_by_plugin_id.get(canonical_plugin_id)
        if canonical_installation is None:
            installation.plugin_id = canonical_plugin_id
            installations_by_plugin_id[canonical_plugin_id] = installation
            db.add(installation)
            did_change = True
            continue

        if canonical_installation.version == canonical_installation.version.__class__() and installation.version:
            canonical_installation.version = installation.version
        canonical_installation.is_enabled = bool(canonical_installation.is_enabled or installation.is_enabled)
        if canonical_installation.auth_state == "not-required" and installation.auth_state:
            canonical_installation.auth_state = installation.auth_state
        if not canonical_installation.auth_message and installation.auth_message:
            canonical_installation.auth_message = installation.auth_message
        if canonical_installation.program_settings in {"", "{}"} and installation.program_settings not in {"", "{}"}:
            canonical_installation.program_settings = installation.program_settings
        if not canonical_installation.created_at and installation.created_at:
            canonical_installation.created_at = installation.created_at
        if installation.updated_at and installation.updated_at > (canonical_installation.updated_at or ""):
            canonical_installation.updated_at = installation.updated_at

        for activation in installation.semester_activations:
            activation.program_plugin_installation = canonical_installation
            db.add(activation)

        db.add(canonical_installation)
        db.delete(installation)
        did_change = True

    if did_change:
        if commit:
            db.commit()
            db.refresh(program)
        else:
            db.flush()


def _wrap_plugin_validation(exc: Exception) -> None:
    if isinstance(exc, plugin_governance.PluginGovernanceValidationError):
        raise PluginGovernanceError(exc.code, exc.message) from exc
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


def _build_semester_review_state(semester: models.Semester) -> dict[str, object]:
    review_errors: list[dict] = []
    plugin_reviews: dict[str, dict[str, object]] = {}

    normalized_name = (semester.name or "").strip()
    if not normalized_name:
        review_errors.append(_build_review_issue(
            code="SEMESTER_NAME_REQUIRED",
            message="Semester name is required.",
            step="basics",
        ))

    if semester.start_date is None or semester.end_date is None:
        review_errors.append(_build_review_issue(
            code="SEMESTER_DATES_REQUIRED",
            message="Semester start_date and end_date are required.",
            step="basics",
        ))
    elif semester.start_date > semester.end_date:
        review_errors.append(_build_review_issue(
            code="INVALID_SEMESTER_DATE_RANGE",
            message="start_date must be earlier than or equal to end_date.",
            step="basics",
        ))
    else:
        review_errors.extend(_validate_reading_week(
            semester_start=semester.start_date,
            semester_end=semester.end_date,
            reading_week_start=semester.reading_week_start,
            reading_week_end=semester.reading_week_end,
        ))

    for activation in semester.plugin_activations:
        plugin_id = activation.program_plugin_installation.plugin_id if activation.program_plugin_installation else None
        plugin_errors: list[dict] = []
        if activation.program_plugin_installation is None or semester.program is None or plugin_id is None:
            plugin_errors.append(_build_review_issue(
                code="PLUGIN_INSTALLATION_NOT_FOUND",
                message="Semester activation is missing its Program plugin installation.",
                step="plugins",
                plugin_id=plugin_id,
            ))
            plugin_reviews[plugin_id or activation.id] = {
                "resolved_settings": {},
                "setup_values": {},
                "setup_summary": [],
                "review_errors": plugin_errors,
            }
            review_errors.extend(plugin_errors)
            continue

        installation = activation.program_plugin_installation
        program_settings = _parse_json_object(installation.program_settings)
        semester_overrides = _parse_json_object(activation.semester_overrides)
        setup_state = _parse_json_object(activation.setup_state)

        try:
            normalized_program_settings = plugin_governance.normalize_program_settings(plugin_id, program_settings)
            normalized_overrides = plugin_governance.normalize_semester_overrides(plugin_id, semester_overrides)
            normalized_setup_state = plugin_governance.normalize_setup_state(plugin_id, setup_state)
            resolved_settings = plugin_governance.resolve_plugin_settings(
                plugin_id,
                program_settings=normalized_program_settings,
                semester_overrides=normalized_overrides,
            )
            setup_values = plugin_governance.validate_resolved_plugin_setup_values(
                plugin_id,
                plugin_governance.resolve_plugin_setup_values(
                    plugin_id,
                    semester_overrides=normalized_overrides,
                    setup_state=normalized_setup_state,
                ),
            )
            setup_summary = plugin_governance.build_plugin_setup_summary(
                plugin_id,
                setup_values=setup_values,
            )
        except plugin_governance.PluginGovernanceValidationError as exc:
            plugin_errors.append(_build_review_issue(
                code=exc.code,
                message=exc.message,
                step="plugin-setup",
                plugin_id=plugin_id,
                field_path=exc.field_path,
            ))
            resolved_settings = {}
            setup_values = {}
            setup_summary = []
        else:
            available, availability_reason = _resolve_semester_plugin_availability(semester, installation, activation)
            if activation.is_enabled and not available:
                plugin_errors.append(_build_review_issue(
                    code="PLUGIN_NOT_AVAILABLE",
                    message=availability_reason or f"Plugin '{plugin_id}' is not available.",
                    step="plugins",
                    plugin_id=plugin_id,
                ))

        plugin_reviews[plugin_id] = {
            "resolved_settings": resolved_settings,
            "setup_values": setup_values,
            "setup_summary": setup_summary,
            "review_errors": plugin_errors,
        }
        review_errors.extend(plugin_errors)

    return {
        "review_ready": len(review_errors) == 0,
        "review_errors": review_errors,
        "plugin_reviews": plugin_reviews,
    }


def _refresh_semester_review_ready(semester: models.Semester) -> dict[str, object]:
    review_state = _build_semester_review_state(semester)
    semester.review_ready = bool(review_state["review_ready"])
    return review_state


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

    update_data = user_update.model_dump(exclude_unset=True)

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

    if "background_plugin_preload" in update_data and update_data["background_plugin_preload"] is not None:
        merged_settings["background_plugin_preload"] = bool(update_data["background_plugin_preload"])
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
    programs = db.query(models.Program).filter(models.Program.owner_id == user_id).offset(skip).limit(limit).all()
    did_change = False
    for program in programs:
        _ensure_default_program_plugin_installations(db, program)
        did_change = _sync_program_subject_color_map(program) or did_change
    if did_change:
        db.commit()
        for program in programs:
            db.refresh(program)
    return programs

def create_program(db: Session, program: schemas.ProgramCreate, user_id: str):
    payload = program.model_dump()
    payload["program_timezone"] = normalize_timezone(payload.get("program_timezone"))
    lms_integration_id = payload.get("lms_integration_id")
    if lms_integration_id:
        integration = (
            db.query(models.LmsIntegration)
            .filter(models.LmsIntegration.id == lms_integration_id, models.LmsIntegration.user_id == user_id)
            .first()
        )
        if integration is None:
            raise ProgramLmsDependencyError("PROGRAM_LMS_INTEGRATION_NOT_FOUND")
    db_program = models.Program(**payload, owner_id=user_id)
    db.add(db_program)
    db.commit()
    db.refresh(db_program)
    _ensure_default_program_plugin_installations(db, db_program)
    db.refresh(db_program)
    return db_program

def get_program(db: Session, program_id: str, user_id: str):
    program = db.query(models.Program).filter(models.Program.id == program_id, models.Program.owner_id == user_id).first()
    if program is None:
        return None
    _ensure_default_program_plugin_installations(db, program)
    if _sync_program_subject_color_map(program):
        db.add(program)
        db.commit()
        db.refresh(program)
    return program

def update_program(db: Session, program_id: str, program_update: schemas.ProgramUpdate, user_id: str):
    db_program = db.query(models.Program).filter(models.Program.id == program_id, models.Program.owner_id == user_id).first()
    if not db_program:
        return None
    update_data = program_update.model_dump(exclude_unset=True)
    if "program_timezone" in update_data:
        update_data["program_timezone"] = normalize_timezone(update_data["program_timezone"])
    if "lms_integration_id" in update_data:
        next_integration_id = update_data["lms_integration_id"]
        if next_integration_id:
            integration = (
                db.query(models.LmsIntegration)
                .filter(models.LmsIntegration.id == next_integration_id, models.LmsIntegration.user_id == user_id)
                .first()
            )
            if integration is None:
                raise ProgramLmsDependencyError("PROGRAM_LMS_INTEGRATION_NOT_FOUND")
        if next_integration_id != db_program.lms_integration_id and db_program.has_lms_dependencies:
            raise ProgramLmsDependencyError("PROGRAM_LMS_DEPENDENCIES_EXIST")
    for key, value in update_data.items():
        setattr(db_program, key, value)
    _sync_program_subject_color_map(db_program)
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


def _ensure_default_program_plugin_installations(db: Session, program: models.Program) -> None:
    _normalize_program_plugin_installations(db, program)
    existing_plugin_ids = {_canonical_plugin_id(installation.plugin_id) for installation in program.plugin_installations}
    now = _now_utc_iso()
    did_change = False
    for plugin_id in plugin_governance.get_default_program_plugin_ids():
        if plugin_id in existing_plugin_ids:
            continue
        definition = plugin_governance.get_plugin_definition(plugin_id)
        db.add(
            models.ProgramPluginInstallation(
                program_id=program.id,
                plugin_id=plugin_id,
                version=definition.default_version,
                is_enabled=definition.default_enabled,
                auth_state=_normalize_auth_state(plugin_id, None),
                program_settings="{}",
                created_at=now,
                updated_at=now,
            )
        )
        did_change = True
    if did_change:
        db.commit()
        db.refresh(program)


def _delete_program_plugin_runtime_data(
    db: Session,
    *,
    program_id: str,
    plugin_id: str,
) -> None:
    plugin_id = _canonical_plugin_id(plugin_id)
    definition = plugin_governance.get_plugin_definition(plugin_id)
    capabilities = definition.capabilities or {}
    tab_types = {
        str(tab_type).strip()
        for tab_type in capabilities.get("available_tab_types", [])
        if str(tab_type).strip()
    }
    widget_types = {
        str(widget_type).strip()
        for widget_type in capabilities.get("available_widget_types", [])
        if str(widget_type).strip()
    }
    semester_ids = [
        semester_id
        for (semester_id,) in db.query(models.Semester.id).filter(models.Semester.program_id == program_id).all()
    ]
    course_ids = [
        course_id
        for (course_id,) in db.query(models.Course.id).filter(models.Course.program_id == program_id).all()
    ]

    if semester_ids:
        db.query(models.PluginSetting).filter(
            models.PluginSetting.plugin_id == plugin_id,
            models.PluginSetting.semester_id.in_(semester_ids),
        ).delete(synchronize_session=False)
        if tab_types:
            db.query(models.Tab).filter(
                models.Tab.semester_id.in_(semester_ids),
                models.Tab.tab_type.in_(tab_types),
            ).delete(synchronize_session=False)
        if widget_types:
            db.query(models.Widget).filter(
                models.Widget.semester_id.in_(semester_ids),
                models.Widget.widget_type.in_(widget_types),
            ).delete(synchronize_session=False)

    if course_ids:
        db.query(models.PluginSetting).filter(
            models.PluginSetting.plugin_id == plugin_id,
            models.PluginSetting.course_id.in_(course_ids),
        ).delete(synchronize_session=False)
        if tab_types:
            db.query(models.Tab).filter(
                models.Tab.course_id.in_(course_ids),
                models.Tab.tab_type.in_(tab_types),
            ).delete(synchronize_session=False)
        if widget_types:
            db.query(models.Widget).filter(
                models.Widget.course_id.in_(course_ids),
                models.Widget.widget_type.in_(widget_types),
            ).delete(synchronize_session=False)

    if plugin_id == "course-resources" and course_ids:
        db.query(models.CourseResourceFile).filter(
            models.CourseResourceFile.course_id.in_(course_ids),
        ).delete(synchronize_session=False)

    if plugin_id == "builtin-gradebook" and course_ids:
        gradebook_ids = [
            gradebook_id
            for (gradebook_id,) in db.query(models.CourseGradebook.id).filter(
                models.CourseGradebook.course_id.in_(course_ids),
            ).all()
        ]
        if gradebook_ids:
            db.query(models.GradebookAssessment).filter(
                models.GradebookAssessment.gradebook_id.in_(gradebook_ids),
            ).delete(synchronize_session=False)
            db.query(models.GradebookAssessmentCategory).filter(
                models.GradebookAssessmentCategory.gradebook_id.in_(gradebook_ids),
            ).delete(synchronize_session=False)
            db.query(models.CourseGradebook).filter(
                models.CourseGradebook.id.in_(gradebook_ids),
            ).delete(synchronize_session=False)

    if plugin_id == "builtin-event-core":
        if semester_ids:
            db.query(models.TodoTask).filter(
                models.TodoTask.semester_id.in_(semester_ids),
            ).delete(synchronize_session=False)
            db.query(models.TodoSection).filter(
                models.TodoSection.semester_id.in_(semester_ids),
            ).delete(synchronize_session=False)
        if course_ids:
            db.query(models.CourseEvent).filter(
                models.CourseEvent.course_id.in_(course_ids),
            ).delete(synchronize_session=False)
            db.query(models.CourseSection).filter(
                models.CourseSection.course_id.in_(course_ids),
            ).delete(synchronize_session=False)
            db.query(models.CourseEventType).filter(
                models.CourseEventType.course_id.in_(course_ids),
            ).delete(synchronize_session=False)


def _ensure_default_semester_plugin_activations(
    db: Session,
    semester: models.Semester,
    *,
    commit: bool = True,
) -> None:
    if semester.program is None:
        db.refresh(semester, attribute_names=["program"])
    program = semester.program
    if program is None:
        raise PluginGovernanceError("PROGRAM_NOT_FOUND", "Semester is missing its parent Program.")
    _ensure_default_program_plugin_installations(db, program)
    existing_installations = {installation.plugin_id: installation for installation in program.plugin_installations}
    existing_activation_installation_ids = {
        activation.program_plugin_installation_id
        for activation in semester.plugin_activations
    }
    now = _now_utc_iso()
    did_change = False
    for plugin_id in plugin_governance.get_default_semester_plugin_ids():
        installation = existing_installations.get(plugin_id)
        if installation is None:
            continue
        if not installation.is_enabled:
            continue
        if installation.id in existing_activation_installation_ids:
            continue
        definition = plugin_governance.get_plugin_definition(plugin_id)
        available, _ = plugin_governance.resolve_plugin_availability(
            plugin_id,
            program_has_lms_integration=bool(program.lms_integration_id),
            auth_state=installation.auth_state,
        )
        if not available:
            continue
        db.add(
            models.SemesterPluginActivation(
                semester_id=semester.id,
                program_plugin_installation_id=installation.id,
                semester_overrides="{}",
                setup_state="{}",
                is_enabled=definition.default_enabled,
                created_at=now,
                updated_at=now,
            )
        )
        did_change = True
    if did_change:
        if commit:
            db.commit()
            db.refresh(semester)
        else:
            db.flush()


def ensure_semester_tabs_normalized(db: Session, semester: models.Semester) -> None:
    _normalize_context_tabs(db, semester=semester)


def ensure_course_tabs_normalized(db: Session, course: models.Course) -> None:
    _normalize_context_tabs(db, course=course)


def _normalize_auth_state(plugin_id: str, auth_state: str | None) -> str:
    try:
        definition = plugin_governance.get_plugin_definition(plugin_id)
    except Exception as exc:
        _wrap_plugin_validation(exc)
    value = (auth_state or "").strip() or (
        "not-required"
        if not definition.requires_authorization
        else "pending"
    )
    allowed = {
        "not-required",
        "pending",
        "authorized",
        "failed",
    }
    if value not in allowed:
        raise PluginGovernanceError(
            "PLUGIN_AUTH_STATE_INVALID",
            f"Unsupported auth_state '{value}' for plugin '{plugin_id}'.",
        )
    return value


def _resolve_program_plugin_availability(
    program: models.Program,
    installation: models.ProgramPluginInstallation | None,
    *,
    plugin_id: str,
) -> tuple[bool, str | None]:
    auth_state = (
        installation.auth_state
        if installation is not None
        else "not-required"
    )
    available, availability_reason = plugin_governance.resolve_plugin_availability(
        plugin_id,
        program_has_lms_integration=bool(program.lms_integration_id),
        auth_state=auth_state,
    )
    if not available:
        return available, availability_reason
    if installation is not None and not installation.is_enabled:
        return False, "Disabled at Program level."
    return True, None


def _resolve_semester_plugin_availability(
    semester: models.Semester,
    installation: models.ProgramPluginInstallation,
    activation: models.SemesterPluginActivation | None,
) -> tuple[bool, str | None]:
    available, availability_reason = _resolve_program_plugin_availability(
        semester.program or installation.program,
        installation,
        plugin_id=installation.plugin_id,
    )
    if not available:
        return available, availability_reason
    if activation is None or not activation.is_enabled:
        return False, "Disabled for this Semester."
    return True, None


def _resolve_semester_plugin_availability_reason(
    semester: models.Semester,
    installation: models.ProgramPluginInstallation,
    activation: models.SemesterPluginActivation | None,
    default_reason: str | None,
) -> str | None:
    available, availability_reason = _resolve_semester_plugin_availability(semester, installation, activation)
    if available:
        return default_reason
    return availability_reason


def _serialize_program_plugin_installation(
    program: models.Program,
    installation: models.ProgramPluginInstallation | None,
    *,
    plugin_id: str,
) -> dict:
    plugin_id = _canonical_plugin_id(plugin_id)
    try:
        definition = plugin_governance.get_plugin_definition(plugin_id)
    except Exception as exc:
        _wrap_plugin_validation(exc)
    auth_state = (
        installation.auth_state
        if installation is not None
        else (
            "not-required"
            if not definition.requires_authorization
            else "pending"
        )
    )
    program_settings = _parse_json_object(installation.program_settings) if installation is not None else {}
    try:
        resolved_program_settings = plugin_governance.resolve_plugin_settings(
            plugin_id,
            program_settings=program_settings,
        )
        available, availability_reason = _resolve_program_plugin_availability(
            program,
            installation,
            plugin_id=plugin_id,
        )
    except Exception as exc:
        _wrap_plugin_validation(exc)
    return {
        "id": installation.id if installation is not None else None,
        "plugin_id": plugin_id,
        "display_name": definition.display_name,
        "description": definition.description,
        "long_description": definition.long_description,
        "author": definition.author,
        "default_version": definition.default_version,
        "default_installed": definition.default_installed,
        "default_enabled": definition.default_enabled,
        "locked": definition.locked,
        "version": installation.version if installation is not None else definition.default_version,
        "is_enabled": installation.is_enabled if installation is not None else False,
        "auth_state": auth_state,
        "auth_message": installation.auth_message if installation is not None else None,
        "requires_authorization": definition.requires_authorization,
        "requires_program_lms_integration": definition.requires_program_lms_integration,
        "capabilities": dict(definition.capabilities),
        "setup_sections": plugin_governance.build_setup_section_payloads(plugin_id),
        "program_settings": program_settings,
        "resolved_program_settings": resolved_program_settings,
        "fields": plugin_governance.build_field_payloads(plugin_id),
        "available": available,
        "availability_reason": availability_reason,
        "installed": installation is not None,
    }


def _serialize_semester_plugin_activation(
    semester: models.Semester,
    activation: models.SemesterPluginActivation | None,
    review_state: dict[str, object] | None = None,
    *,
    installation: models.ProgramPluginInstallation | None = None,
) -> dict:
    if installation is None:
        installation = activation.program_plugin_installation if activation is not None else None
    if installation is None:
        activation_id = activation.id if activation is not None else "missing"
        raise PluginGovernanceError(
            "PLUGIN_INSTALLATION_NOT_FOUND",
            f"Semester activation '{activation_id}' is missing its Program plugin installation.",
        )
    program = semester.program
    if program is None:
        raise PluginGovernanceError(
            "PROGRAM_NOT_FOUND",
            f"Semester '{semester.id}' is missing its parent Program.",
        )
    installation.plugin_id = _canonical_plugin_id(installation.plugin_id)
    installation_payload = _serialize_program_plugin_installation(
        program,
        installation,
        plugin_id=installation.plugin_id,
    )
    semester_overrides = _parse_json_object(activation.semester_overrides) if activation is not None else {}
    setup_state = _parse_json_object(activation.setup_state) if activation is not None else {}
    current_review_state = review_state or _build_semester_review_state(semester)
    plugin_review = (current_review_state.get("plugin_reviews") or {}).get(installation.plugin_id, {})
    resolved_settings = plugin_review.get("resolved_settings") or {}
    setup_summary = plugin_review.get("setup_summary") or []
    review_errors = plugin_review.get("review_errors") or []
    return {
        "id": activation.id if activation is not None else None,
        "semester_id": semester.id,
        "program_plugin_installation_id": installation.id,
        "plugin_id": installation.plugin_id,
        "display_name": installation_payload["display_name"],
        "description": installation_payload["description"],
        "long_description": installation_payload["long_description"],
        "author": installation_payload["author"],
        "locked": installation_payload["locked"],
        "version": installation.version,
        "is_enabled": bool(activation.is_enabled) if activation is not None else False,
        "auth_state": installation.auth_state,
        "capabilities": installation_payload["capabilities"],
        "setup_sections": installation_payload["setup_sections"],
        "semester_overrides": semester_overrides,
        "setup_state": setup_state,
        "resolved_settings": resolved_settings,
        "fields": installation_payload["fields"],
        "setup_summary": setup_summary,
        "review_errors": review_errors,
        "available": _resolve_semester_plugin_availability(semester, installation, activation)[0],
        "availability_reason": _resolve_semester_plugin_availability_reason(
            semester,
            installation,
            activation,
            installation_payload["availability_reason"],
        ),
    }


def _serialize_plugin_system_setup_plugin(
    semester: models.Semester,
    activation: models.SemesterPluginActivation,
    review_state: dict[str, object],
) -> dict:
    installation = activation.program_plugin_installation
    if installation is None:
        raise PluginGovernanceError(
            "PLUGIN_INSTALLATION_NOT_FOUND",
            f"Semester activation '{activation.id}' is missing its Program plugin installation.",
        )
    plugin_review = (review_state.get("plugin_reviews") or {}).get(installation.plugin_id, {})
    return {
        "plugin_id": installation.plugin_id,
        "display_name": plugin_governance.get_plugin_definition(installation.plugin_id).display_name,
        "description": plugin_governance.get_plugin_definition(installation.plugin_id).description,
        "long_description": plugin_governance.get_plugin_definition(installation.plugin_id).long_description,
        "author": plugin_governance.get_plugin_definition(installation.plugin_id).author,
        "is_enabled": activation.is_enabled,
        "available": _resolve_semester_plugin_availability(semester, installation, activation)[0],
        "availability_reason": _resolve_semester_plugin_availability_reason(
            semester,
            installation,
            activation,
            None,
        ),
        "setup_sections": plugin_governance.build_plugin_setup_sections(installation.plugin_id),
        "setup_values": plugin_review.get("setup_values") or {},
        "setup_summary": plugin_review.get("setup_summary") or [],
        "review_errors": plugin_review.get("review_errors") or [],
    }


def get_program_plugin_catalog(db: Session, program_id: str) -> list[dict]:
    program = db.query(models.Program).filter(models.Program.id == program_id).first()
    if program is None:
        return []
    _ensure_default_program_plugin_installations(db, program)
    installations_by_plugin = {
        installation.plugin_id: installation
        for installation in program.plugin_installations
    }
    return [
        _serialize_program_plugin_installation(
            program,
            installations_by_plugin.get(definition.plugin_id),
            plugin_id=definition.plugin_id,
        )
        for definition in plugin_governance.list_plugin_definitions()
    ]


def get_program_plugin_installations(db: Session, program_id: str) -> list[dict]:
    program = db.query(models.Program).filter(models.Program.id == program_id).first()
    if program is None:
        return []
    _normalize_program_plugin_installations(db, program)
    _ensure_default_program_plugin_installations(db, program)
    return [
        _serialize_program_plugin_installation(program, installation, plugin_id=installation.plugin_id)
        for installation in sorted(program.plugin_installations, key=lambda item: item.plugin_id)
    ]


def upsert_program_plugin_installation(
    db: Session,
    program_id: str,
    plugin_id: str,
    payload: schemas.ProgramPluginInstallationUpsertRequest,
) -> dict:
    plugin_id = _canonical_plugin_id(plugin_id)
    program = db.query(models.Program).filter(models.Program.id == program_id).first()
    if program is None:
        raise PluginGovernanceError("PROGRAM_NOT_FOUND", "Program not found.")
    _normalize_program_plugin_installations(db, program)

    try:
        definition = plugin_governance.get_plugin_definition(plugin_id)
    except Exception as exc:
        _wrap_plugin_validation(exc)
    installation = (
        db.query(models.ProgramPluginInstallation)
        .filter(
            models.ProgramPluginInstallation.program_id == program_id,
            models.ProgramPluginInstallation.plugin_id == plugin_id,
        )
        .first()
    )
    update_data = payload.model_dump(exclude_unset=True)
    now = _now_utc_iso()

    if installation is None:
        installation = models.ProgramPluginInstallation(
            program_id=program_id,
            plugin_id=plugin_id,
            is_enabled=True,
            created_at=now,
        )

    if "version" in update_data:
        installation.version = str(update_data["version"] or "").strip() or definition.default_version
    elif not installation.version:
        installation.version = definition.default_version

    if "is_enabled" in update_data:
        installation.is_enabled = bool(update_data["is_enabled"])
    elif installation.is_enabled is None:
        installation.is_enabled = True

    if "auth_state" in update_data or installation.auth_state is None:
        installation.auth_state = _normalize_auth_state(plugin_id, update_data.get("auth_state"))
    else:
        installation.auth_state = _normalize_auth_state(plugin_id, installation.auth_state)

    if "auth_message" in update_data:
        installation.auth_message = str(update_data.get("auth_message") or "").strip() or None

    if "program_settings" in update_data:
        try:
            normalized_program_settings = plugin_governance.normalize_program_settings(
                plugin_id,
                update_data["program_settings"],
            )
        except Exception as exc:
            _wrap_plugin_validation(exc)
        installation.program_settings = _serialize_json_object(normalized_program_settings)
    elif not installation.program_settings:
        installation.program_settings = "{}"

    installation.updated_at = now
    db.add(installation)
    db.commit()
    db.refresh(installation)
    return _serialize_program_plugin_installation(program, installation, plugin_id=plugin_id)


def delete_program_plugin_installation(db: Session, program_id: str, plugin_id: str) -> models.ProgramPluginInstallation | None:
    plugin_id = _canonical_plugin_id(plugin_id)
    try:
        definition = plugin_governance.get_plugin_definition(plugin_id)
    except Exception as exc:
        _wrap_plugin_validation(exc)
    if definition.locked:
        raise PluginGovernanceError(
            "PLUGIN_LOCKED",
            f"Plugin '{plugin_id}' is locked and cannot be uninstalled.",
        )
    installation = (
        db.query(models.ProgramPluginInstallation)
        .filter(
            models.ProgramPluginInstallation.program_id == program_id,
            models.ProgramPluginInstallation.plugin_id == plugin_id,
        )
        .first()
    )
    if installation is None:
        return None
    _delete_program_plugin_runtime_data(db, program_id=program_id, plugin_id=plugin_id)
    db.delete(installation)
    db.commit()
    return installation


def get_semester_plugin_activations(db: Session, semester_id: str) -> list[dict]:
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        return []
    if semester.program is not None:
        _normalize_program_plugin_installations(db, semester.program)
        _ensure_default_program_plugin_installations(db, semester.program)
    _ensure_default_semester_plugin_activations(db, semester)
    if semester.lifecycle_state == "draft":
        semester.draft_updated_at = semester.draft_updated_at or _now_utc_iso()
    review_state = _refresh_semester_review_ready(semester)
    activations_by_installation_id = {
        activation.program_plugin_installation_id: activation
        for activation in semester.plugin_activations
        if activation.program_plugin_installation_id
    }
    enabled_installations = sorted(
        (
            installation
            for installation in (semester.program.plugin_installations if semester.program is not None else [])
            if installation.is_enabled
        ),
        key=lambda item: item.plugin_id,
    )
    return [
        _serialize_semester_plugin_activation(
            semester,
            activations_by_installation_id.get(installation.id),
            installation=installation,
            review_state=review_state,
        )
        for installation in enabled_installations
    ]


def get_plugin_system_setup_definition(plugin_id: str) -> dict:
    plugin_id = _canonical_plugin_id(plugin_id)
    try:
        plugin_governance.get_plugin_definition(plugin_id)
    except KeyError as exc:
        raise PluginGovernanceError("PLUGIN_NOT_FOUND", str(exc)) from exc
    except Exception as exc:
        _wrap_plugin_validation(exc)
    return {
        "plugin_id": plugin_id,
        "sections": plugin_governance.build_plugin_setup_sections(plugin_id),
    }


def get_semester_plugin_system_setup(db: Session, semester_id: str) -> dict:
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        raise PluginGovernanceError("SEMESTER_NOT_FOUND", "Semester not found.")
    if semester.program is not None:
        _ensure_default_program_plugin_installations(db, semester.program)
    _ensure_default_semester_plugin_activations(db, semester)
    review_state = _refresh_semester_review_ready(semester)
    enabled_activations = sorted(
        (activation for activation in semester.plugin_activations if activation.is_enabled),
        key=lambda item: item.program_plugin_installation.plugin_id if item.program_plugin_installation is not None else "",
    )
    return {
        "semester_id": semester.id,
        "step": "plugin-setup",
        "plugins": [
            _serialize_plugin_system_setup_plugin(semester, activation, review_state)
            for activation in enabled_activations
        ],
    }


def review_semester_plugin_system(db: Session, semester_id: str) -> dict:
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        raise PluginGovernanceError("SEMESTER_NOT_FOUND", "Semester not found.")
    if semester.program is not None:
        _ensure_default_program_plugin_installations(db, semester.program)
    _ensure_default_semester_plugin_activations(db, semester)
    review_state = _refresh_semester_review_ready(semester)
    enabled_activations = sorted(
        (activation for activation in semester.plugin_activations if activation.is_enabled),
        key=lambda item: item.program_plugin_installation.plugin_id if item.program_plugin_installation is not None else "",
    )
    serialized_plugins = [
        _serialize_plugin_system_setup_plugin(semester, activation, review_state)
        for activation in enabled_activations
    ]
    return {
        "semester_id": semester.id,
        "plugins": [
            {
                "plugin_id": plugin["plugin_id"],
                "review_errors": plugin["review_errors"],
                "setup_summary": plugin["setup_summary"],
            }
            for plugin in serialized_plugins
        ],
        "has_errors": any(plugin["review_errors"] for plugin in serialized_plugins),
    }


def update_semester_plugin_system_setup(
    db: Session,
    semester_id: str,
    plugin_id: str,
    payload: schemas.PluginSystemSemesterSetupUpdateRequest,
) -> dict:
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        raise PluginGovernanceError("SEMESTER_NOT_FOUND", "Semester not found.")
    if semester.program_id is None:
        raise PluginGovernanceError("PROGRAM_NOT_FOUND", "Semester is missing its parent Program.")
    installation = (
        db.query(models.ProgramPluginInstallation)
        .filter(
            models.ProgramPluginInstallation.program_id == semester.program_id,
            models.ProgramPluginInstallation.plugin_id == plugin_id,
        )
        .first()
    )
    if installation is None:
        raise PluginGovernanceError(
            "PLUGIN_NOT_INSTALLED",
            f"Plugin '{plugin_id}' is not installed for this Program.",
        )
    activation = (
        db.query(models.SemesterPluginActivation)
        .filter(
            models.SemesterPluginActivation.semester_id == semester_id,
            models.SemesterPluginActivation.program_plugin_installation_id == installation.id,
        )
        .first()
    )
    if activation is None:
        raise PluginGovernanceError(
            "PLUGIN_NOT_ENABLED",
            f"Plugin '{plugin_id}' is not enabled for this Semester.",
        )
    if not activation.is_enabled:
        raise PluginGovernanceError(
            "PLUGIN_NOT_ENABLED",
            f"Plugin '{plugin_id}' is disabled for this Semester.",
        )

    current_semester_overrides = _parse_json_object(activation.semester_overrides)
    current_setup_state = _parse_json_object(activation.setup_state)
    try:
        next_setup_state, next_semester_overrides, normalized_values = plugin_governance.write_plugin_setup_values(
            plugin_id,
            semester_overrides=current_semester_overrides,
            setup_state=current_setup_state,
            values=payload.values,
        )
    except Exception as exc:
        _wrap_plugin_validation(exc)

    now = _now_utc_iso()
    activation.setup_state = _serialize_json_object(next_setup_state)
    activation.semester_overrides = _serialize_json_object(next_semester_overrides)
    activation.updated_at = now
    semester.draft_updated_at = now if semester.lifecycle_state == "draft" else semester.draft_updated_at
    _refresh_semester_review_ready(semester)
    db.add(activation)
    db.add(semester)
    db.commit()
    db.refresh(activation)
    db.refresh(semester)
    review_state = _build_semester_review_state(semester)
    plugin_review = (review_state.get("plugin_reviews") or {}).get(plugin_id, {})
    return {
        "semester_id": semester.id,
        "plugin_id": plugin_id,
        "setup_values": normalized_values,
        "setup_summary": plugin_review.get("setup_summary") or [],
        "review_errors": plugin_review.get("review_errors") or [],
    }


def upsert_semester_plugin_activation(
    db: Session,
    semester_id: str,
    plugin_id: str,
    payload: schemas.SemesterPluginActivationUpsertRequest,
) -> dict:
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        raise PluginGovernanceError("SEMESTER_NOT_FOUND", "Semester not found.")
    if semester.program_id is None:
        raise PluginGovernanceError("PROGRAM_NOT_FOUND", "Semester is missing its parent Program.")
    installation = (
        db.query(models.ProgramPluginInstallation)
        .filter(
            models.ProgramPluginInstallation.program_id == semester.program_id,
            models.ProgramPluginInstallation.plugin_id == plugin_id,
        )
        .first()
    )
    if installation is None:
        raise PluginGovernanceError(
            "PLUGIN_NOT_INSTALLED",
            f"Plugin '{plugin_id}' is not installed for this Program.",
        )
    activation = (
        db.query(models.SemesterPluginActivation)
        .filter(
            models.SemesterPluginActivation.semester_id == semester_id,
            models.SemesterPluginActivation.program_plugin_installation_id == installation.id,
        )
        .first()
    )
    requested_enabled = (
        payload.is_enabled
        if payload.is_enabled is not None
        else (activation.is_enabled if activation is not None else True)
    )
    available, availability_reason = _resolve_program_plugin_availability(
        semester.program,
        installation,
        plugin_id=plugin_id,
    )
    if requested_enabled and not available:
        raise PluginGovernanceError(
            "PLUGIN_NOT_AVAILABLE",
            availability_reason or f"Plugin '{plugin_id}' is not available for activation.",
        )
    update_data = payload.model_dump(exclude_unset=True)
    now = _now_utc_iso()

    if activation is None:
        activation = models.SemesterPluginActivation(
            semester_id=semester_id,
            program_plugin_installation_id=installation.id,
            is_enabled=True,
            created_at=now,
        )

    if not activation.semester_overrides:
        activation.semester_overrides = "{}"

    if not activation.setup_state:
        activation.setup_state = "{}"

    if "is_enabled" in update_data:
        activation.is_enabled = bool(update_data["is_enabled"])
    elif activation.is_enabled is None:
        activation.is_enabled = True

    activation.updated_at = now
    semester.draft_updated_at = now if semester.lifecycle_state == "draft" else semester.draft_updated_at
    _refresh_semester_review_ready(semester)
    db.add(activation)
    db.add(semester)
    db.commit()
    db.refresh(activation)
    db.refresh(semester)
    review_state = _build_semester_review_state(semester)
    return _serialize_semester_plugin_activation(semester, activation, review_state)


def delete_semester_plugin_activation(db: Session, semester_id: str, plugin_id: str) -> models.SemesterPluginActivation | None:
    plugin_id = _canonical_plugin_id(plugin_id)
    try:
        definition = plugin_governance.get_plugin_definition(plugin_id)
    except Exception as exc:
        _wrap_plugin_validation(exc)
    if definition.locked:
        raise PluginGovernanceError(
            "PLUGIN_LOCKED",
            f"Plugin '{plugin_id}' is locked and cannot be disabled.",
        )
    activation = (
        db.query(models.SemesterPluginActivation)
        .join(models.ProgramPluginInstallation)
        .filter(
            models.SemesterPluginActivation.semester_id == semester_id,
            models.ProgramPluginInstallation.plugin_id == plugin_id,
        )
        .first()
    )
    if activation is None:
        return None
    semester = activation.semester
    db.delete(activation)
    if semester is not None:
        if semester.lifecycle_state == "draft":
            semester.draft_updated_at = _now_utc_iso()
        _refresh_semester_review_ready(semester)
        db.add(semester)
    db.commit()
    return activation


def get_course_inherited_plugin_activations(db: Session, course_id: str) -> list[dict]:
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if course is None or course.semester_id is None:
        return []
    return [
        activation
        for activation in get_semester_plugin_activations(db, course.semester_id)
        if activation.get("is_enabled")
    ]


def get_current_semester_draft(db: Session, program_id: str) -> models.Semester | None:
    return (
        db.query(models.Semester)
        .filter(
            models.Semester.program_id == program_id,
            models.Semester.lifecycle_state == "draft",
        )
        .order_by(models.Semester.draft_updated_at.desc(), models.Semester.id.desc())
        .first()
    )


def _serialize_semester_draft(semester: models.Semester) -> dict:
    review_state = _refresh_semester_review_ready(semester)
    payload = {
        "id": semester.id,
        "program_id": semester.program_id,
        "name": semester.name,
        "average_percentage": semester.average_percentage,
        "average_scaled": semester.average_scaled,
        "start_date": semester.start_date,
        "end_date": semester.end_date,
        "reading_week_start": semester.reading_week_start,
        "reading_week_end": semester.reading_week_end,
        "lifecycle_state": semester.lifecycle_state,
        "creation_step": semester.creation_step,
        "draft_updated_at": semester.draft_updated_at,
        "review_ready": semester.review_ready,
        "review_errors": review_state["review_errors"],
        "plugin_activations": [
            _serialize_semester_plugin_activation(semester, activation, review_state)
            for activation in sorted(
                semester.plugin_activations,
                key=lambda item: item.program_plugin_installation.plugin_id if item.program_plugin_installation is not None else "",
            )
        ] if (db := Session.object_session(semester)) else [],
    }
    return payload


def create_semester_draft(
    db: Session,
    program_id: str,
    payload: schemas.SemesterDraftCreateRequest,
) -> dict:
    program = db.query(models.Program).filter(models.Program.id == program_id).first()
    if program is None:
        raise PluginGovernanceError("PROGRAM_NOT_FOUND", "Program not found.")
    _ensure_default_program_plugin_installations(db, program)
    existing_draft = get_current_semester_draft(db, program_id)
    if existing_draft is not None:
        raise PluginGovernanceError(
            "SEMESTER_DRAFT_EXISTS",
            "A Semester draft is already in progress for this Program.",
        )
    create_payload = payload.model_dump()
    start_date = create_payload.get("start_date")
    end_date = create_payload.get("end_date")
    if start_date is None or end_date is None:
        default_start, default_end = get_default_semester_dates()
        create_payload["start_date"] = start_date or default_start
        create_payload["end_date"] = end_date or default_end
    now = _now_utc_iso()
    db_semester = models.Semester(
        **create_payload,
        program_id=program_id,
        lifecycle_state="draft",
        draft_updated_at=now,
        review_ready=False,
    )
    db.add(db_semester)
    try:
        db.flush()
        _ensure_default_semester_plugin_activations(db, db_semester, commit=False)
        db.add(
            models.Widget(
                widget_type="course-list",
                is_removable=False,
                semester_id=db_semester.id,
            )
        )
        _refresh_semester_review_ready(db_semester)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if get_current_semester_draft(db, program_id) is not None:
            raise PluginGovernanceError(
                "SEMESTER_DRAFT_EXISTS",
                "A Semester draft is already in progress for this Program.",
            ) from exc
        raise
    except Exception:
        db.rollback()
        raise
    db.refresh(db_semester)
    return _serialize_semester_draft(db_semester)


def update_semester_draft(
    db: Session,
    semester_id: str,
    payload: schemas.SemesterDraftUpdateRequest,
) -> dict:
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        raise PluginGovernanceError("SEMESTER_NOT_FOUND", "Semester not found.")
    if semester.lifecycle_state != "draft":
        raise PluginGovernanceError("SEMESTER_NOT_DRAFT", "Only draft Semesters can be updated through the wizard.")

    update_data = payload.model_dump(exclude_unset=True)
    if "start_date" in update_data and update_data["start_date"] is None:
        update_data["start_date"] = semester.start_date
    if "end_date" in update_data and update_data["end_date"] is None:
        update_data["end_date"] = semester.end_date
    for key, value in update_data.items():
        setattr(semester, key, value)
    semester.draft_updated_at = _now_utc_iso()
    _refresh_semester_review_ready(semester)
    db.add(semester)
    db.commit()
    db.refresh(semester)
    return _serialize_semester_draft(semester)


def finalize_semester_draft(db: Session, semester_id: str) -> dict:
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        raise PluginGovernanceError("SEMESTER_NOT_FOUND", "Semester not found.")
    if semester.lifecycle_state != "draft":
        raise PluginGovernanceError("SEMESTER_NOT_DRAFT", "Only draft Semesters can be finalized.")
    review_state = _refresh_semester_review_ready(semester)
    if not semester.review_ready:
        first_error = next(iter(review_state["review_errors"]), None)
        message = (
            first_error["message"]
            if isinstance(first_error, dict) and first_error.get("message")
            else "Resolve the draft review errors before finalizing this Semester."
        )
        raise PluginGovernanceError("SEMESTER_DRAFT_REVIEW_FAILED", message)
    semester.lifecycle_state = "active"
    semester.creation_step = "review"
    semester.draft_updated_at = _now_utc_iso()
    semester.review_ready = True
    db.add(semester)
    db.commit()
    db.refresh(semester)
    return _serialize_semester_draft(semester)


def discard_semester_draft(db: Session, semester_id: str) -> models.Semester | None:
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        return None
    if semester.lifecycle_state != "draft":
        raise PluginGovernanceError("SEMESTER_NOT_DRAFT", "Only draft Semesters can be discarded.")
    db.delete(semester)
    db.commit()
    return semester

# --- Semester CRUD ---
def get_semesters(db: Session, program_id: str):
    # Verify program belongs to user (logic should be in route or here)
    # For now assuming simple fetch
    return db.query(models.Semester).filter(models.Semester.program_id == program_id).all()

def create_semester(db: Session, semester: schemas.SemesterCreate, program_id: str):
    program = db.query(models.Program).filter(models.Program.id == program_id).first()
    if program is None:
        raise PluginGovernanceError("PROGRAM_NOT_FOUND", "Program not found.")
    _ensure_default_program_plugin_installations(db, program)
    payload = semester.model_dump()
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
    _ensure_default_semester_plugin_activations(db, db_semester)
    _refresh_semester_review_ready(db_semester)
    db.add(db_semester)
    db.commit()
    db.refresh(db_semester)
    if not any(widget.widget_type == "course-list" for widget in db_semester.widgets):
        create_widget(
            db,
            schemas.WidgetCreate(
                widget_type="course-list",
                is_removable=False,
            ),
            semester_id=db_semester.id,
        )
    return db_semester

def update_semester(db: Session, semester_id: str, semester_update: schemas.SemesterCreate):
    db_semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if not db_semester:
        return None
    update_data = semester_update.model_dump()
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


def _validate_course_semester_assignment(
    db: Session,
    course: models.Course,
    semester_id: str | None,
) -> None:
    if semester_id is None:
        return

    target_semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if target_semester is None:
        raise CourseSemesterAssignmentError("SEMESTER_NOT_FOUND")
    if target_semester.program_id != course.program_id:
        raise CourseSemesterAssignmentError("SEMESTER_PROGRAM_MISMATCH")

def create_course(db: Session, course: schemas.CourseCreate, program_id: str, semester_id: str | None = None):
    db_course = models.Course(**course.model_dump(), program_id=program_id, semester_id=semester_id)
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
    db.refresh(db_course)
    gradebook.ensure_course_gradebook(db, db_course)
    if db_course.program and _sync_program_subject_color_map(db_course.program):
        db.add(db_course.program)
        db.commit()
    db.refresh(db_course)

    logic.update_course_stats(db_course, db)
    if db_course.semester is not None and db_course.semester.lifecycle_state == "draft":
        db_course.semester.draft_updated_at = _now_utc_iso()
        _refresh_semester_review_ready(db_course.semester)
        db.add(db_course.semester)
        db.commit()
        db.refresh(db_course.semester)
    
    return db_course

def update_course(db: Session, course_id: str, course_update: schemas.CourseUpdate):
    db_course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not db_course:
        return None

    previous_semester_id = db_course.semester_id
    update_data = course_update.model_dump(exclude_unset=True)
    if "semester_id" in update_data:
        _validate_course_semester_assignment(db, db_course, update_data["semester_id"])

    for key, value in update_data.items():
        setattr(db_course, key, value)
    if db_course.program:
        _sync_program_subject_color_map(db_course.program)
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    
    logic.update_course_stats(db_course, db)
    if previous_semester_id and previous_semester_id != db_course.semester_id:
        previous_semester = db.query(models.Semester).filter(models.Semester.id == previous_semester_id).first()
        if previous_semester is not None:
            logic.update_semester_stats(previous_semester, db)
            if previous_semester.lifecycle_state == "draft":
                previous_semester.draft_updated_at = _now_utc_iso()
                _refresh_semester_review_ready(previous_semester)
                db.add(previous_semester)
                db.commit()

    current_semester = db_course.semester
    if current_semester is not None and current_semester.lifecycle_state == "draft":
        current_semester.draft_updated_at = _now_utc_iso()
        _refresh_semester_review_ready(current_semester)
        db.add(current_semester)
        db.commit()
    
    return db_course


def delete_course(db: Session, course_id: str):
    db_course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not db_course:
        return None

    previous_semester_id = db_course.semester_id
    program_id = db_course.program_id
    db.delete(db_course)
    db.commit()

    if previous_semester_id:
        previous_semester = db.query(models.Semester).filter(models.Semester.id == previous_semester_id).first()
        if previous_semester is not None:
            logic.update_semester_stats(previous_semester, db)
            if previous_semester.lifecycle_state == "draft":
                previous_semester.draft_updated_at = _now_utc_iso()
                _refresh_semester_review_ready(previous_semester)
                db.add(previous_semester)
                db.commit()

    if program_id:
        program = db.query(models.Program).filter(models.Program.id == program_id).first()
        if program is not None and _sync_program_subject_color_map(program):
            db.add(program)
            db.commit()

    return db_course

def _ensure_widget_context(semester_id: str | None, course_id: str | None):
    if (semester_id is None and course_id is None) or (semester_id is not None and course_id is not None):
        raise ValueError("Widget must be attached to exactly one context (semester_id or course_id).")

def _ensure_tab_context(semester_id: str | None, course_id: str | None):
    if (semester_id is None and course_id is None) or (semester_id is not None and course_id is not None):
        raise ValueError("Tab must be attached to exactly one context (semester_id or course_id).")

def _ensure_plugin_settings_context(semester_id: str | None, course_id: str | None):
    if (semester_id is None and course_id is None) or (semester_id is not None and course_id is not None):
        raise ValueError("Plugin settings must be attached to exactly one context (semester_id or course_id).")

# --- Widget CRUD ---
def create_widget(db: Session, widget: schemas.WidgetCreate, semester_id: str | None = None, course_id: str | None = None):
    _ensure_widget_context(semester_id, course_id)
    db_widget = models.Widget(**widget.model_dump(), semester_id=semester_id, course_id=course_id)
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
    for key, value in widget_update.model_dump(exclude_unset=True).items():
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
    data = tab.model_dump()
    data["tab_type"] = _canonical_tab_type(data.get("tab_type"))
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
    update_data = tab_update.model_dump(exclude_unset=True)
    if "tab_type" in update_data:
        update_data["tab_type"] = _canonical_tab_type(update_data["tab_type"])
    for key, value in update_data.items():
        setattr(db_tab, key, value)
    db.add(db_tab)
    db.commit()
    db.refresh(db_tab)
    return db_tab

# --- Plugin Settings CRUD ---
def get_plugin_settings_for_context(
    db: Session,
    semester_id: str | None = None,
    course_id: str | None = None,
):
    _ensure_plugin_settings_context(semester_id, course_id)
    query = db.query(models.PluginSetting)
    if semester_id is not None:
        query = query.filter(models.PluginSetting.semester_id == semester_id)
    if course_id is not None:
        query = query.filter(models.PluginSetting.course_id == course_id)
    return query.order_by(models.PluginSetting.plugin_id.asc()).all()

def get_plugin_setting(
    db: Session,
    plugin_id: str,
    semester_id: str | None = None,
    course_id: str | None = None,
):
    _ensure_plugin_settings_context(semester_id, course_id)
    query = db.query(models.PluginSetting).filter(models.PluginSetting.plugin_id == plugin_id)
    if semester_id is not None:
        query = query.filter(models.PluginSetting.semester_id == semester_id)
    if course_id is not None:
        query = query.filter(models.PluginSetting.course_id == course_id)
    return query.first()

def upsert_plugin_setting(
    db: Session,
    plugin_setting: schemas.PluginSettingCreate,
    semester_id: str | None = None,
    course_id: str | None = None,
):
    _ensure_plugin_settings_context(semester_id, course_id)
    db_plugin_setting = get_plugin_setting(
        db,
        plugin_id=plugin_setting.plugin_id,
        semester_id=semester_id,
        course_id=course_id,
    )
    if db_plugin_setting is None:
        db_plugin_setting = models.PluginSetting(
            plugin_id=plugin_setting.plugin_id,
            semester_id=semester_id,
            course_id=course_id,
        )

    db_plugin_setting.settings = plugin_setting.settings
    db.add(db_plugin_setting)
    db.commit()
    db.refresh(db_plugin_setting)
    return db_plugin_setting
