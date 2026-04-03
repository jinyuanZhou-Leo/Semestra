# input:  [SQLAlchemy session, plugin management registry, Program/Semester/Course models, shared CRUD helpers, and layout persistence helpers plus tab-settings storage]
# output: [Program/Semester/Course plugin-management helpers, setup flows, review serialization, and default activation/install maintenance]
# pos:    [Plugin-governance slice of backend CRUD that owns install/activation/setup/readiness state across Program, Semester, and unassigned Course scopes, with setup values now projected into tab-settings storage]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

import functools
from dataclasses import dataclass
from typing import Callable

from sqlalchemy.orm import Session

import models
import plugin_registry
import schemas
from crud_layout import _ensure_course_plugin_tabs, get_tab_setting, resolve_tab_settings, upsert_tab_setting
from crud_shared import (
    PluginRegistryError,
    _build_review_issue,
    _canonical_plugin_id,
    _now_utc_iso,
    _parse_json_object,
    _serialize_json_object,
    _validate_reading_week,
    _wrap_plugin_validation,
)


# ── B-13: decorator to auto-canonicalize the `plugin_id` argument (positional or keyword) ─
def _with_canonical_plugin_id(func):
    """Decorator that normalises the ``plugin_id`` argument before the wrapped
    function sees it, eliminating the repetitive first-line pattern
    ``plugin_id = _canonical_plugin_id(plugin_id)`` in every public function.

    Supports both positional and keyword call styles so existing call-sites
    do not need to be changed.
    """
    import inspect as _inspect
    _params = list(_inspect.signature(func).parameters.keys())
    try:
        _plugin_id_index = _params.index("plugin_id")
    except ValueError as _exc:
        raise TypeError(
            f"@_with_canonical_plugin_id: '{func.__name__}' has no 'plugin_id' parameter"
        ) from _exc

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        if "plugin_id" in kwargs:
            kwargs["plugin_id"] = _canonical_plugin_id(kwargs["plugin_id"])
        elif _plugin_id_index < len(args):
            args = args[:_plugin_id_index] + (_canonical_plugin_id(args[_plugin_id_index]),) + args[_plugin_id_index + 1:]
        return func(*args, **kwargs)
    return wrapper


def _build_availability(
    *,
    available: bool,
    reason_code: str | None = None,
    reason_message: str | None = None,
) -> dict[str, object]:
    if available:
        return {
            "state": "available",
            "reason_code": None,
            "reason_message": None,
        }
    return {
        "state": "unavailable",
        "reason_code": reason_code,
        "reason_message": reason_message,
    }


@dataclass(frozen=True)
class _PluginSetupStoragePlan:
    definition: plugin_registry.PluginSetupDefinition | None
    field_map: dict[str, plugin_registry.PluginSetupFieldDefinition]
    settings_keys: tuple[str, ...]


def _build_plugin_setup_storage_plan(plugin_id: str) -> _PluginSetupStoragePlan:
    try:
        definition = plugin_registry.get_plugin_setup_definition(plugin_id)
    except (KeyError, RuntimeError, plugin_registry.PluginRegistryValidationError) as exc:
        _wrap_plugin_validation(exc)
    if definition is None:
        return _PluginSetupStoragePlan(definition=None, field_map={}, settings_keys=())

    field_map = {field.path: field for field in definition.fields}
    ordered_settings_keys: list[str] = []
    seen_settings_keys: set[str] = set()
    for field in definition.fields:
        settings_key = str(field.settings_key or "").strip()
        if not settings_key or settings_key in seen_settings_keys:
            continue
        seen_settings_keys.add(settings_key)
        ordered_settings_keys.append(settings_key)
    return _PluginSetupStoragePlan(
        definition=definition,
        field_map=field_map,
        settings_keys=tuple(ordered_settings_keys),
    )


def _group_plugin_setup_values_by_settings_key(
    storage_plan: _PluginSetupStoragePlan,
    values: dict[str, object] | None,
) -> dict[str, dict[str, object]]:
    grouped_values: dict[str, dict[str, object]] = {}
    for field_path, value in (values or {}).items():
        field = storage_plan.field_map.get(field_path)
        if field is None:
            continue
        grouped_values.setdefault(field.settings_key, {})[field_path] = value
    return grouped_values


def _resolve_semester_plugin_setup_values(
    db: Session,
    semester: models.Semester,
    plugin_id: str,
    *,
    tab_settings_cache: dict[str, models.TabSetting] | None = None,
) -> dict[str, object]:
    """Resolve setup values for one plugin in a semester.

    Args:
        tab_settings_cache: Optional pre-loaded mapping of ``settings_key ->
            TabSetting`` for this semester.  When provided, no additional
            database queries are issued for TabSetting rows (B-05 fix).
    """
    storage_plan = _build_plugin_setup_storage_plan(plugin_id)
    if storage_plan.definition is None:
        return {}

    resolved_values_by_settings_key: dict[str, dict[str, object]] = {}
    for settings_key in storage_plan.settings_keys:
        if tab_settings_cache is not None:
            # B-05: use pre-loaded cache instead of hitting the DB each time
            tab_setting = tab_settings_cache.get(settings_key)
            resolved_values_by_settings_key[settings_key] = _parse_json_object(
                tab_setting.settings if tab_setting is not None else None
            )
        else:
            resolved_values_by_settings_key[settings_key] = resolve_tab_settings(
                db,
                settings_key,
                program_id=semester.program_id,
                semester_id=semester.id,
            )

    return plugin_registry.resolve_plugin_setup_values(
        plugin_id,
        setup_values={
            field_path: resolved_values_by_settings_key.get(field.settings_key, {}).get(field_path)
            for field_path, field in storage_plan.field_map.items()
            if field.settings_key in resolved_values_by_settings_key and field_path in resolved_values_by_settings_key[field.settings_key]
        },
    )


def _build_semester_plugin_setup_summary(
    db: Session,
    semester: models.Semester,
    plugin_id: str,
    *,
    tab_settings_cache: dict[str, models.TabSetting] | None = None,
) -> list[dict[str, object]]:
    if not plugin_registry.has_plugin_setup_definition(plugin_id):
        return []
    return plugin_registry.build_plugin_setup_summary(
        plugin_id,
        setup_values=_resolve_semester_plugin_setup_values(
            db, semester, plugin_id, tab_settings_cache=tab_settings_cache
        ),
    )


def _write_semester_plugin_setup_values(
    db: Session,
    *,
    semester_id: str,
    storage_plan: _PluginSetupStoragePlan,
    values: dict[str, object] | None,
) -> None:
    for settings_key, settings_bucket_values in _group_plugin_setup_values_by_settings_key(storage_plan, values).items():
        existing_tab_setting = get_tab_setting(
            db,
            settings_key,
            semester_id=semester_id,
        )
        existing_scope_settings = _parse_json_object(existing_tab_setting.settings if existing_tab_setting is not None else None)
        next_scope_settings = {
            **existing_scope_settings,
            **settings_bucket_values,
        }
        upsert_tab_setting(
            db,
            schemas.TabSettingCreate(
                settings_key=settings_key,
                settings=_serialize_json_object(next_scope_settings),
            ),
            semester_id=semester_id,
        )


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
        if plugin_registry.is_host_reserved_plugin_id(canonical_plugin_id):
            db.delete(installation)
            did_change = True
            continue
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
        if not canonical_installation.created_at and installation.created_at:
            canonical_installation.created_at = installation.created_at
        if installation.updated_at and installation.updated_at > (canonical_installation.updated_at or ""):
            canonical_installation.updated_at = installation.updated_at

        for activation in installation.semester_activations:
            activation.program_plugin_installation = canonical_installation
            db.add(activation)

        for activation in installation.course_activations:
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


def _build_semester_review_state(db: Session, semester: models.Semester) -> dict[str, object]:
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

    # B-05: Pre-load all TabSetting rows for this semester in one query to avoid
    # N×M database hits (N plugins × M settings_keys per plugin).
    tab_settings_cache: dict[str, models.TabSetting] = {
        ts.settings_key: ts
        for ts in (
            db.query(models.TabSetting)
            .filter(models.TabSetting.semester_id == semester.id)
            .all()
        )
    }

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
                "setup_values": {},
                "setup_summary": [],
                "review_errors": plugin_errors,
            }
            review_errors.extend(plugin_errors)
            continue

        installation = activation.program_plugin_installation
        try:
            setup_values = _resolve_semester_plugin_setup_values(
                db, semester, plugin_id, tab_settings_cache=tab_settings_cache
            )
            setup_summary = _build_semester_plugin_setup_summary(
                db, semester, plugin_id, tab_settings_cache=tab_settings_cache
            )
        except (KeyError, RuntimeError, plugin_registry.PluginRegistryValidationError) as exc:
            _wrap_plugin_validation(exc)

        available, _, availability_reason = _resolve_semester_plugin_availability(semester, installation, activation)
        if activation.is_enabled and not available:
            plugin_errors.append(_build_review_issue(
                code="PLUGIN_NOT_AVAILABLE",
                message=availability_reason or f"Plugin '{plugin_id}' is not available.",
                step="plugins",
                plugin_id=plugin_id,
            ))

        plugin_reviews[plugin_id] = {
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


def _refresh_semester_review_ready(db: Session, semester: models.Semester) -> dict[str, object]:
    review_state = _build_semester_review_state(db, semester)
    semester.review_ready = bool(review_state["review_ready"])
    return review_state


def _normalize_auth_state(plugin_id: str, auth_state: str | None) -> str:
    try:
        definition = plugin_registry.get_plugin_definition(plugin_id)
    except (KeyError, RuntimeError, plugin_registry.PluginRegistryValidationError) as exc:
        _wrap_plugin_validation(exc)
    value = (auth_state or "").strip() or ("not-required" if not definition.requires_authorization else "pending")
    allowed = {"not-required", "pending", "authorized", "failed"}
    if value not in allowed:
        raise PluginRegistryError(
            "PLUGIN_AUTH_STATE_INVALID",
            f"Unsupported auth_state '{value}' for plugin '{plugin_id}'.",
        )
    return value


def _ensure_default_program_plugin_installations(db: Session, program: models.Program) -> None:
    _normalize_program_plugin_installations(db, program)
    existing_plugin_ids = {_canonical_plugin_id(installation.plugin_id) for installation in program.plugin_installations}
    now = _now_utc_iso()
    did_change = False
    for plugin_id in plugin_registry.get_default_program_plugin_ids():
        if plugin_id in existing_plugin_ids:
            continue
        definition = plugin_registry.get_plugin_definition(plugin_id)
        db.add(
                models.ProgramPluginInstallation(
                    program_id=program.id,
                    plugin_id=plugin_id,
                    version=definition.default_version,
                    is_enabled=definition.default_enabled,
                    auth_state=_normalize_auth_state(plugin_id, None),
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
    definition = plugin_registry.get_plugin_definition(plugin_id)
    capabilities = definition.capabilities or {}
    tab_types = {
        str(tab_type).strip()
        for tab_type in capabilities.get("available_tab_types", [])
        if str(tab_type).strip()
    }
    settings_keys = {plugin_id, *_build_plugin_setup_storage_plan(plugin_id).settings_keys, *tab_types}
    widget_types = {
        str(widget_type).strip()
        for widget_type in capabilities.get("available_widget_types", [])
        if str(widget_type).strip()
    }
    semester_ids = [semester_id for (semester_id,) in db.query(models.Semester.id).filter(models.Semester.program_id == program_id).all()]
    course_ids = [course_id for (course_id,) in db.query(models.Course.id).filter(models.Course.program_id == program_id).all()]

    if semester_ids:
        if settings_keys:
            db.query(models.TabSetting).filter(
                models.TabSetting.settings_key.in_(settings_keys),
                models.TabSetting.semester_id.in_(semester_ids),
            ).delete(synchronize_session=False)
        if tab_types:
            db.query(models.WorkspaceTabOrderEntry).filter(
                models.WorkspaceTabOrderEntry.semester_id.in_(semester_ids),
                models.WorkspaceTabOrderEntry.tab_type.in_(tab_types),
            ).delete(synchronize_session=False)
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
        if settings_keys:
            db.query(models.TabSetting).filter(
                models.TabSetting.settings_key.in_(settings_keys),
                models.TabSetting.course_id.in_(course_ids),
            ).delete(synchronize_session=False)
        if tab_types:
            db.query(models.WorkspaceTabOrderEntry).filter(
                models.WorkspaceTabOrderEntry.course_id.in_(course_ids),
                models.WorkspaceTabOrderEntry.tab_type.in_(tab_types),
            ).delete(synchronize_session=False)
            db.query(models.Tab).filter(
                models.Tab.course_id.in_(course_ids),
                models.Tab.tab_type.in_(tab_types),
            ).delete(synchronize_session=False)
        if widget_types:
            db.query(models.Widget).filter(
                models.Widget.course_id.in_(course_ids),
                models.Widget.widget_type.in_(widget_types),
            ).delete(synchronize_session=False)

    # ─── Plugin-specific domain data cleanup (registered via _PLUGIN_CLEANUP_HOOKS) ───
    cleanup_hook = _PLUGIN_CLEANUP_HOOKS.get(plugin_id)
    if cleanup_hook is not None:
        cleanup_hook(db, semester_ids=semester_ids, course_ids=course_ids)


def _cleanup_course_resources(db: Session, *, semester_ids: list[str], course_ids: list[str]) -> None:
    if course_ids:
        db.query(models.CourseResourceFile).filter(
            models.CourseResourceFile.course_id.in_(course_ids),
        ).delete(synchronize_session=False)


def _cleanup_builtin_gradebook(db: Session, *, semester_ids: list[str], course_ids: list[str]) -> None:
    if not course_ids:
        return
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


def _cleanup_builtin_event_core(db: Session, *, semester_ids: list[str], course_ids: list[str]) -> None:
    if semester_ids:
        db.query(models.TodoTask).filter(models.TodoTask.semester_id.in_(semester_ids)).delete(synchronize_session=False)
        db.query(models.TodoSection).filter(models.TodoSection.semester_id.in_(semester_ids)).delete(synchronize_session=False)
    if course_ids:
        db.query(models.CourseEvent).filter(models.CourseEvent.course_id.in_(course_ids)).delete(synchronize_session=False)
        db.query(models.CourseSection).filter(models.CourseSection.course_id.in_(course_ids)).delete(synchronize_session=False)
        db.query(models.CourseEventType).filter(models.CourseEventType.course_id.in_(course_ids)).delete(synchronize_session=False)


_PLUGIN_CLEANUP_HOOKS: dict[str, Callable[..., None]] = {
    "course-resources": _cleanup_course_resources,
    "builtin-gradebook": _cleanup_builtin_gradebook,
    "builtin-event-core": _cleanup_builtin_event_core,
}


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
        raise PluginRegistryError("PROGRAM_NOT_FOUND", "Semester is missing its parent Program.")
    _ensure_default_program_plugin_installations(db, program)
    existing_installations = {installation.plugin_id: installation for installation in program.plugin_installations}
    existing_activation_installation_ids = {activation.program_plugin_installation_id for activation in semester.plugin_activations}
    now = _now_utc_iso()
    did_change = False
    for plugin_id in plugin_registry.get_default_semester_plugin_ids():
        installation = existing_installations.get(plugin_id)
        if installation is None or not installation.is_enabled or installation.id in existing_activation_installation_ids:
            continue
        definition = plugin_registry.get_plugin_definition(plugin_id)
        available, _ = plugin_registry.resolve_plugin_availability(
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


def _resolve_program_plugin_availability(
    program: models.Program,
    installation: models.ProgramPluginInstallation | None,
    *,
    plugin_id: str,
) -> tuple[bool, str | None, str | None]:
    auth_state = installation.auth_state if installation is not None else "not-required"
    available, availability_reason = plugin_registry.resolve_plugin_availability(
        plugin_id,
        program_has_lms_integration=bool(program.lms_integration_id),
        auth_state=auth_state,
    )
    if not available:
        reason_code = "requires_dependency"
        if installation is None:
            reason_code = "not_installed"
        elif auth_state not in {"authorized", "not-required"}:
            reason_code = "permission_denied"
        return False, reason_code, availability_reason
    if installation is not None and not installation.is_enabled:
        return False, "not_enabled", "Disabled at Program level."
    if installation is None:
        return False, "not_installed", "Plugin is not installed for this Program."
    return True, None, None


# ── B-14: shared base for semester/course availability check ──────────────────
def _resolve_scoped_plugin_availability_base(
    *,
    program: models.Program,
    installation: models.ProgramPluginInstallation,
    plugin_id: str,
) -> tuple[bool, str | None, str | None]:
    """Check program-level availability; shared by semester and course resolvers."""
    return _resolve_program_plugin_availability(program, installation, plugin_id=plugin_id)


def _resolve_semester_plugin_availability(
    semester: models.Semester,
    installation: models.ProgramPluginInstallation,
    activation: models.SemesterPluginActivation | None,
) -> tuple[bool, str | None, str | None]:
    available, reason_code, reason_message = _resolve_scoped_plugin_availability_base(
        program=semester.program or installation.program,
        installation=installation,
        plugin_id=installation.plugin_id,
    )
    if not available:
        return available, reason_code, reason_message
    if activation is None or not activation.is_enabled:
        return False, "not_enabled", "Disabled for this Semester."
    return True, None, None


def _supports_unassigned_course(plugin_id: str) -> bool:
    try:
        definition = plugin_registry.get_plugin_definition(plugin_id)
    except (KeyError, RuntimeError, plugin_registry.PluginRegistryValidationError) as exc:
        _wrap_plugin_validation(exc)
    return bool((definition.capabilities or {}).get("supports_unassigned_course"))


def _resolve_course_plugin_availability(
    course: models.Course,
    installation: models.ProgramPluginInstallation,
    activation: models.ProgramCoursePluginActivation | None,
) -> tuple[bool, str | None, str | None]:
    program = course.program or installation.program
    if program is None:
        raise PluginRegistryError("PROGRAM_NOT_FOUND", f"Course '{course.id}' is missing its parent Program.")
    # B-14: reuse shared base instead of duplicating _resolve_program_plugin_availability call
    available, reason_code, reason_message = _resolve_scoped_plugin_availability_base(
        program=program, installation=installation, plugin_id=installation.plugin_id
    )
    if not available:
        return available, reason_code, reason_message
    if course.semester_id is not None:
        return False, "requires_parent_scope", "This contribution is governed by the parent Semester."
    if not _supports_unassigned_course(installation.plugin_id):
        return False, "not_supported_in_scope", "This plugin does not support Courses without a Semester."
    if activation is None or not activation.is_enabled:
        return False, "not_enabled", "Disabled for this Course."
    return True, None, None


def _resolve_course_plugin_availability_reason(
    course: models.Course,
    installation: models.ProgramPluginInstallation,
    activation: models.ProgramCoursePluginActivation | None,
    default_reason: str | None,
) -> str | None:
    available, _, availability_reason = _resolve_course_plugin_availability(course, installation, activation)
    if available:
        return default_reason
    return availability_reason


def _resolve_semester_plugin_availability_reason(
    semester: models.Semester,
    installation: models.ProgramPluginInstallation,
    activation: models.SemesterPluginActivation | None,
    default_reason: str | None,
) -> str | None:
    available, _, availability_reason = _resolve_semester_plugin_availability(semester, installation, activation)
    if available:
        return default_reason
    return availability_reason


def _serialize_program_plugin_installation(program: models.Program, installation: models.ProgramPluginInstallation | None, *, plugin_id: str) -> dict:
    plugin_id = _canonical_plugin_id(plugin_id)
    try:
        definition = plugin_registry.get_plugin_definition(plugin_id)
    except (KeyError, RuntimeError, plugin_registry.PluginRegistryValidationError) as exc:
        _wrap_plugin_validation(exc)
    auth_state = installation.auth_state if installation is not None else ("not-required" if not definition.requires_authorization else "pending")
    try:
        available, reason_code, availability_reason = _resolve_program_plugin_availability(program, installation, plugin_id=plugin_id)
    except (KeyError, RuntimeError, plugin_registry.PluginRegistryValidationError) as exc:
        _wrap_plugin_validation(exc)
    return {
        "id": installation.id if installation is not None else None,
        "plugin_id": plugin_id,
        "display_name": definition.display_name,
        "description": definition.description,
        "long_description": definition.long_description,
        "author": definition.author,
        "default_version": definition.default_version,
        "locked": definition.locked,
        "version": installation.version if installation is not None else definition.default_version,
        "is_enabled": installation.is_enabled if installation is not None else False,
        "auth_state": auth_state,
        "auth_message": installation.auth_message if installation is not None else None,
        "capabilities": dict(definition.capabilities),
        "setup_sections": plugin_registry.build_plugin_setup_sections(plugin_id),
        "available": available,
        "availability_reason": availability_reason,
        "availability": _build_availability(
            available=available,
            reason_code=reason_code,
            reason_message=availability_reason,
        ),
        "installed": installation is not None,
    }


def _serialize_semester_plugin_activation(
    db: Session,
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
        raise PluginRegistryError("PLUGIN_INSTALLATION_NOT_FOUND", f"Semester activation '{activation_id}' is missing its Program plugin installation.")
    program = semester.program
    if program is None:
        raise PluginRegistryError("PROGRAM_NOT_FOUND", f"Semester '{semester.id}' is missing its parent Program.")
    canonical_id = _canonical_plugin_id(installation.plugin_id)
    installation_payload = _serialize_program_plugin_installation(program, installation, plugin_id=canonical_id)
    setup_values = _resolve_semester_plugin_setup_values(db, semester, canonical_id)
    current_review_state = review_state or _build_semester_review_state(db, semester)
    plugin_review = (current_review_state.get("plugin_reviews") or {}).get(canonical_id, {})
    setup_summary = plugin_review.get("setup_summary") or []
    review_errors = plugin_review.get("review_errors") or []
    runtime_available, runtime_reason_code, runtime_reason_message = _resolve_semester_plugin_availability(
        semester,
        installation,
        activation,
    )
    return {
        "id": activation.id if activation is not None else None,
        "semester_id": semester.id,
        "program_plugin_installation_id": installation.id,
        "plugin_id": canonical_id,
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
        "setup_values": setup_values,
        "setup_summary": setup_summary,
        "review_errors": review_errors,
        "available": runtime_available,
        "availability_reason": runtime_reason_message,
        "availability": _build_availability(
            available=runtime_available,
            reason_code=runtime_reason_code,
            reason_message=runtime_reason_message,
        ),
    }


def _serialize_course_plugin_activation(
    course: models.Course,
    activation: models.ProgramCoursePluginActivation | None,
    *,
    installation: models.ProgramPluginInstallation | None = None,
    source: str = "course",
    is_enabled: bool | None = None,
    available: bool | None = None,
    availability_reason: str | None = None,
) -> dict:
    if installation is None:
        installation = activation.program_plugin_installation if activation is not None else None
    if installation is None:
        activation_id = activation.id if activation is not None else "missing"
        raise PluginRegistryError("PLUGIN_INSTALLATION_NOT_FOUND", f"Course activation '{activation_id}' is missing its Program plugin installation.")
    program = course.program or installation.program
    if program is None:
        raise PluginRegistryError("PROGRAM_NOT_FOUND", f"Course '{course.id}' is missing its parent Program.")
    canonical_id = _canonical_plugin_id(installation.plugin_id)
    installation_payload = _serialize_program_plugin_installation(program, installation, plugin_id=canonical_id)
    runtime_available_default, runtime_reason_code, runtime_reason_message = _resolve_course_plugin_availability(
        course,
        installation,
        activation,
    )
    resolved_is_enabled = is_enabled if is_enabled is not None else (bool(activation.is_enabled) if activation is not None else False)
    resolved_available = available if available is not None else runtime_available_default
    resolved_availability_reason = availability_reason if availability_reason is not None else runtime_reason_message
    return {
        "id": activation.id if activation is not None else None,
        "course_id": course.id,
        "program_plugin_installation_id": installation.id,
        "plugin_id": canonical_id,
        "display_name": installation_payload["display_name"],
        "description": installation_payload["description"],
        "long_description": installation_payload["long_description"],
        "author": installation_payload["author"],
        "locked": installation_payload["locked"],
        "version": installation.version,
        "is_enabled": resolved_is_enabled,
        "auth_state": installation.auth_state,
        "capabilities": installation_payload["capabilities"],
        "available": resolved_available,
        "availability_reason": resolved_availability_reason,
        "availability": _build_availability(
            available=resolved_available,
            reason_code=None if resolved_available and available is not None else runtime_reason_code,
            reason_message=resolved_availability_reason,
        ),
        "source": source,
    }


def _serialize_plugin_system_setup_plugin(semester: models.Semester, activation: models.SemesterPluginActivation, review_state: dict[str, object]) -> dict:
    installation = activation.program_plugin_installation
    if installation is None:
        raise PluginRegistryError("PLUGIN_INSTALLATION_NOT_FOUND", f"Semester activation '{activation.id}' is missing its Program plugin installation.")
    plugin_review = (review_state.get("plugin_reviews") or {}).get(installation.plugin_id, {})
    definition = plugin_registry.get_plugin_definition(installation.plugin_id)
    runtime_available, runtime_reason_code, runtime_reason_message = _resolve_semester_plugin_availability(
        semester,
        installation,
        activation,
    )
    return {
        "plugin_id": installation.plugin_id,
        "display_name": definition.display_name,
        "description": definition.description,
        "long_description": definition.long_description,
        "author": definition.author,
        "is_enabled": activation.is_enabled,
        "available": runtime_available,
        "availability_reason": runtime_reason_message,
        "availability": _build_availability(
            available=runtime_available,
            reason_code=runtime_reason_code,
            reason_message=runtime_reason_message,
        ),
        "setup_sections": plugin_registry.build_plugin_setup_sections(installation.plugin_id),
        "setup_values": plugin_review.get("setup_values") or {},
        "setup_summary": plugin_review.get("setup_summary") or [],
        "review_errors": plugin_review.get("review_errors") or [],
    }


def get_program_plugin_catalog(db: Session, program_id: str) -> list[dict]:
    program = db.query(models.Program).filter(models.Program.id == program_id).first()
    if program is None:
        return []
    _ensure_default_program_plugin_installations(db, program)
    installations_by_plugin = {installation.plugin_id: installation for installation in program.plugin_installations}
    return [
        _serialize_program_plugin_installation(program, installations_by_plugin.get(definition.plugin_id), plugin_id=definition.plugin_id)
        for definition in plugin_registry.list_plugin_definitions()
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


@_with_canonical_plugin_id
def upsert_program_plugin_installation(db: Session, program_id: str, plugin_id: str, payload: schemas.ProgramPluginInstallationUpsertRequest) -> dict:
    program = db.query(models.Program).filter(models.Program.id == program_id).first()
    if program is None:
        raise PluginRegistryError("PROGRAM_NOT_FOUND", "Program not found.")
    _normalize_program_plugin_installations(db, program)
    try:
        definition = plugin_registry.get_plugin_definition(plugin_id)
    except (KeyError, RuntimeError, plugin_registry.PluginRegistryValidationError) as exc:
        _wrap_plugin_validation(exc)
    installation = (
        db.query(models.ProgramPluginInstallation)
        .filter(models.ProgramPluginInstallation.program_id == program_id, models.ProgramPluginInstallation.plugin_id == plugin_id)
        .first()
    )
    update_data = payload.model_dump(exclude_unset=True)
    now = _now_utc_iso()

    if installation is None:
        installation = models.ProgramPluginInstallation(program_id=program_id, plugin_id=plugin_id, is_enabled=True, created_at=now)

    requested_enabled = update_data["is_enabled"] if "is_enabled" in update_data else installation.is_enabled
    if requested_enabled is False and definition.locked:
        raise PluginRegistryError("PLUGIN_LOCKED", f"Plugin '{plugin_id}' is locked and cannot be disabled.")

    candidate_auth_state = (
        _normalize_auth_state(plugin_id, update_data.get("auth_state"))
        if "auth_state" in update_data or installation.auth_state is None
        else _normalize_auth_state(plugin_id, installation.auth_state)
    )
    installation.auth_state = candidate_auth_state
    available, _, availability_reason = _resolve_program_plugin_availability(program, installation, plugin_id=plugin_id)
    if requested_enabled and not available:
        raise PluginRegistryError("PLUGIN_NOT_AVAILABLE", availability_reason or f"Plugin '{plugin_id}' is not available for activation.")

    if "version" in update_data:
        installation.version = str(update_data["version"] or "").strip() or definition.default_version
    elif not installation.version:
        installation.version = definition.default_version
    if "is_enabled" in update_data:
        installation.is_enabled = bool(update_data["is_enabled"])
    elif installation.is_enabled is None:
        installation.is_enabled = True
    installation.auth_state = candidate_auth_state
    if "auth_message" in update_data:
        installation.auth_message = str(update_data.get("auth_message") or "").strip() or None
    installation.updated_at = now
    db.add(installation)
    db.commit()
    db.refresh(installation)
    return _serialize_program_plugin_installation(program, installation, plugin_id=plugin_id)


def bulk_update_program_plugin_installations(db: Session, program_id: str, payload: schemas.ProgramPluginInstallationBulkUpdateRequest) -> list[dict]:
    program = db.query(models.Program).filter(models.Program.id == program_id).first()
    if program is None:
        raise PluginRegistryError("PROGRAM_NOT_FOUND", "Program not found.")
    _normalize_program_plugin_installations(db, program)
    canonical_plugin_ids: list[str] = []
    seen_plugin_ids: set[str] = set()
    for plugin_id in payload.plugin_ids:
        canonical_plugin_id = _canonical_plugin_id(plugin_id)
        if canonical_plugin_id in seen_plugin_ids:
            continue
        seen_plugin_ids.add(canonical_plugin_id)
        canonical_plugin_ids.append(canonical_plugin_id)
    if not canonical_plugin_ids:
        raise PluginRegistryError("PLUGIN_IDS_REQUIRED", "Provide at least one plugin id.")

    installations = (
        db.query(models.ProgramPluginInstallation)
        .filter(models.ProgramPluginInstallation.program_id == program_id, models.ProgramPluginInstallation.plugin_id.in_(canonical_plugin_ids))
        .all()
    )
    installations_by_plugin_id = {installation.plugin_id: installation for installation in installations}
    missing_plugin_id = next((plugin_id for plugin_id in canonical_plugin_ids if plugin_id not in installations_by_plugin_id), None)
    if missing_plugin_id is not None:
        raise PluginRegistryError("PLUGIN_NOT_INSTALLED", f"Plugin '{missing_plugin_id}' is not installed for this Program.")

    now = _now_utc_iso()
    for plugin_id in canonical_plugin_ids:
        installation = installations_by_plugin_id[plugin_id]
        try:
            definition = plugin_registry.get_plugin_definition(plugin_id)
        except (KeyError, RuntimeError, plugin_registry.PluginRegistryValidationError) as exc:
            _wrap_plugin_validation(exc)
        if definition.locked:
            raise PluginRegistryError("PLUGIN_LOCKED", f"Plugin '{plugin_id}' is locked and cannot be disabled.")
        available, _, availability_reason = _resolve_program_plugin_availability(program, installation, plugin_id=plugin_id)
        if payload.is_enabled and not available:
            raise PluginRegistryError("PLUGIN_NOT_AVAILABLE", availability_reason or f"Plugin '{plugin_id}' is not available for activation.")
        installation.is_enabled = payload.is_enabled
        if not installation.version:
            installation.version = definition.default_version
        if installation.auth_state is None:
            installation.auth_state = _normalize_auth_state(plugin_id, None)
        installation.updated_at = now
        db.add(installation)

    db.commit()
    db.refresh(program)
    return [
        _serialize_program_plugin_installation(program, installation, plugin_id=installation.plugin_id)
        for installation in sorted(program.plugin_installations, key=lambda item: item.plugin_id)
    ]


@_with_canonical_plugin_id
def delete_program_plugin_installation(db: Session, program_id: str, plugin_id: str) -> models.ProgramPluginInstallation | None:
    try:
        definition = plugin_registry.get_plugin_definition(plugin_id)
    except (KeyError, RuntimeError, plugin_registry.PluginRegistryValidationError) as exc:
        _wrap_plugin_validation(exc)
    if definition.locked:
        raise PluginRegistryError("PLUGIN_LOCKED", f"Plugin '{plugin_id}' is locked and cannot be uninstalled.")
    installation = (
        db.query(models.ProgramPluginInstallation)
        .filter(models.ProgramPluginInstallation.program_id == program_id, models.ProgramPluginInstallation.plugin_id == plugin_id)
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
    review_state = _refresh_semester_review_ready(db, semester)
    activations_by_installation_id = {
        activation.program_plugin_installation_id: activation
        for activation in semester.plugin_activations
        if activation.program_plugin_installation_id
    }
    enabled_installations = sorted(
        (installation for installation in (semester.program.plugin_installations if semester.program is not None else []) if installation.is_enabled),
        key=lambda item: item.plugin_id,
    )
    return [
        _serialize_semester_plugin_activation(db, semester, activations_by_installation_id.get(installation.id), installation=installation, review_state=review_state)
        for installation in enabled_installations
    ]


@_with_canonical_plugin_id
def get_plugin_system_setup_definition(plugin_id: str) -> dict:
    try:
        plugin_registry.get_plugin_definition(plugin_id)
    except KeyError as exc:
        raise PluginRegistryError("PLUGIN_NOT_FOUND", str(exc)) from exc
    except (KeyError, RuntimeError, plugin_registry.PluginRegistryValidationError) as exc:
        _wrap_plugin_validation(exc)
    return {"plugin_id": plugin_id, "sections": plugin_registry.build_plugin_setup_sections(plugin_id)}


def get_semester_plugin_system_setup(db: Session, semester_id: str) -> dict:
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        raise PluginRegistryError("SEMESTER_NOT_FOUND", "Semester not found.")
    if semester.program is not None:
        _ensure_default_program_plugin_installations(db, semester.program)
    _ensure_default_semester_plugin_activations(db, semester)
    review_state = _refresh_semester_review_ready(db, semester)
    enabled_activations = sorted((activation for activation in semester.plugin_activations if activation.is_enabled), key=lambda item: item.program_plugin_installation.plugin_id if item.program_plugin_installation is not None else "")
    return {
        "semester_id": semester.id,
        "step": "plugin-setup",
        "plugins": [_serialize_plugin_system_setup_plugin(semester, activation, review_state) for activation in enabled_activations],
    }


def review_semester_plugin_system(db: Session, semester_id: str) -> dict:
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        raise PluginRegistryError("SEMESTER_NOT_FOUND", "Semester not found.")
    if semester.program is not None:
        _ensure_default_program_plugin_installations(db, semester.program)
    _ensure_default_semester_plugin_activations(db, semester)
    review_state = _refresh_semester_review_ready(db, semester)
    enabled_activations = sorted((activation for activation in semester.plugin_activations if activation.is_enabled), key=lambda item: item.program_plugin_installation.plugin_id if item.program_plugin_installation is not None else "")
    serialized_plugins = [_serialize_plugin_system_setup_plugin(semester, activation, review_state) for activation in enabled_activations]
    return {
        "semester_id": semester.id,
        "plugins": [{"plugin_id": plugin["plugin_id"], "review_errors": plugin["review_errors"], "setup_summary": plugin["setup_summary"]} for plugin in serialized_plugins],
        "has_errors": any(plugin["review_errors"] for plugin in serialized_plugins),
    }


@_with_canonical_plugin_id
def update_semester_plugin_system_setup(db: Session, semester_id: str, plugin_id: str, payload: schemas.PluginSystemSemesterSetupUpdateRequest) -> dict:
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        raise PluginRegistryError("SEMESTER_NOT_FOUND", "Semester not found.")
    if semester.program_id is None:
        raise PluginRegistryError("PROGRAM_NOT_FOUND", "Semester is missing its parent Program.")
    installation = (
        db.query(models.ProgramPluginInstallation)
        .filter(models.ProgramPluginInstallation.program_id == semester.program_id, models.ProgramPluginInstallation.plugin_id == plugin_id)
        .first()
    )
    if installation is None:
        raise PluginRegistryError("PLUGIN_NOT_INSTALLED", f"Plugin '{plugin_id}' is not installed for this Program.")
    activation = (
        db.query(models.SemesterPluginActivation)
        .filter(models.SemesterPluginActivation.semester_id == semester_id, models.SemesterPluginActivation.program_plugin_installation_id == installation.id)
        .first()
    )
    if activation is None or not activation.is_enabled:
        raise PluginRegistryError("PLUGIN_NOT_ENABLED", f"Plugin '{plugin_id}' is not enabled for this Semester.")

    now = _now_utc_iso()
    storage_plan = _build_plugin_setup_storage_plan(plugin_id)
    unknown_field_paths = sorted(set((payload.values or {}).keys()) - set(storage_plan.field_map.keys()))
    if unknown_field_paths:
        raise PluginRegistryError(
            "PLUGIN_SYSTEM_SETUP_UNKNOWN_FIELD",
            f"Unknown plugin setup keys for {plugin_id}: {', '.join(unknown_field_paths)}",
        )
    current_setup_values = _resolve_semester_plugin_setup_values(db, semester, plugin_id)
    candidate_setup_values = {
        **current_setup_values,
        **(payload.values or {}),
    }
    try:
        validated_setup_values = plugin_registry.validate_resolved_plugin_setup_values(
            plugin_id,
            candidate_setup_values,
        )
    except (KeyError, RuntimeError, plugin_registry.PluginRegistryValidationError) as exc:
        _wrap_plugin_validation(exc)
    normalized_update_values = {
        field_path: validated_setup_values[field_path]
        for field_path in (payload.values or {}).keys()
        if field_path in validated_setup_values
    }
    _write_semester_plugin_setup_values(
        db,
        semester_id=semester_id,
        storage_plan=storage_plan,
        values=normalized_update_values,
    )
    activation.updated_at = now
    semester.draft_updated_at = now if semester.lifecycle_state == "draft" else semester.draft_updated_at
    _refresh_semester_review_ready(db, semester)
    db.add(activation)
    db.add(semester)
    db.commit()
    db.refresh(activation)
    db.refresh(semester)
    review_state = _build_semester_review_state(db, semester)
    plugin_review = (review_state.get("plugin_reviews") or {}).get(plugin_id, {})
    return {
        "semester_id": semester.id,
        "plugin_id": plugin_id,
        "setup_values": plugin_review.get("setup_values") or {},
        "setup_summary": plugin_review.get("setup_summary") or [],
        "review_errors": plugin_review.get("review_errors") or [],
    }


@_with_canonical_plugin_id
def upsert_semester_plugin_activation(db: Session, semester_id: str, plugin_id: str, payload: schemas.SemesterPluginActivationUpsertRequest) -> dict:
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        raise PluginRegistryError("SEMESTER_NOT_FOUND", "Semester not found.")
    if semester.program_id is None:
        raise PluginRegistryError("PROGRAM_NOT_FOUND", "Semester is missing its parent Program.")
    installation = (
        db.query(models.ProgramPluginInstallation)
        .filter(models.ProgramPluginInstallation.program_id == semester.program_id, models.ProgramPluginInstallation.plugin_id == plugin_id)
        .first()
    )
    if installation is None:
        raise PluginRegistryError("PLUGIN_NOT_INSTALLED", f"Plugin '{plugin_id}' is not installed for this Program.")
    try:
        definition = plugin_registry.get_plugin_definition(plugin_id)
    except (KeyError, RuntimeError, plugin_registry.PluginRegistryValidationError) as exc:
        _wrap_plugin_validation(exc)
    activation = (
        db.query(models.SemesterPluginActivation)
        .filter(models.SemesterPluginActivation.semester_id == semester_id, models.SemesterPluginActivation.program_plugin_installation_id == installation.id)
        .first()
    )
    requested_enabled = payload.is_enabled if payload.is_enabled is not None else (activation.is_enabled if activation is not None else True)
    if not requested_enabled and definition.locked:
        raise PluginRegistryError("PLUGIN_LOCKED", f"Plugin '{plugin_id}' is locked and cannot be disabled.")
    available, _, availability_reason = _resolve_program_plugin_availability(semester.program, installation, plugin_id=plugin_id)
    if requested_enabled and not available:
        raise PluginRegistryError("PLUGIN_NOT_AVAILABLE", availability_reason or f"Plugin '{plugin_id}' is not available for activation.")
    update_data = payload.model_dump(exclude_unset=True)
    now = _now_utc_iso()

    if activation is None:
        activation = models.SemesterPluginActivation(
            semester_id=semester_id,
            program_plugin_installation_id=installation.id,
            is_enabled=True,
            created_at=now,
        )
    if "is_enabled" in update_data:
        activation.is_enabled = bool(update_data["is_enabled"])
    elif activation.is_enabled is None:
        activation.is_enabled = True
    activation.updated_at = now
    semester.draft_updated_at = now if semester.lifecycle_state == "draft" else semester.draft_updated_at
    _refresh_semester_review_ready(db, semester)
    db.add(activation)
    db.add(semester)
    db.commit()
    db.refresh(activation)
    db.refresh(semester)
    review_state = _build_semester_review_state(db, semester)
    return _serialize_semester_plugin_activation(db, semester, activation, review_state)


def bulk_update_semester_plugin_activations(db: Session, semester_id: str, payload: schemas.SemesterPluginActivationBulkUpdateRequest) -> dict:
    semester = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if semester is None:
        raise PluginRegistryError("SEMESTER_NOT_FOUND", "Semester not found.")
    if semester.program_id is None:
        raise PluginRegistryError("PROGRAM_NOT_FOUND", "Semester is missing its parent Program.")
    canonical_plugin_ids: list[str] = []
    seen_plugin_ids: set[str] = set()
    for plugin_id in payload.plugin_ids:
        canonical_plugin_id = _canonical_plugin_id(plugin_id)
        if canonical_plugin_id in seen_plugin_ids:
            continue
        seen_plugin_ids.add(canonical_plugin_id)
        canonical_plugin_ids.append(canonical_plugin_id)
    if not canonical_plugin_ids:
        raise PluginRegistryError("PLUGIN_IDS_REQUIRED", "Provide at least one plugin id.")

    installations = (
        db.query(models.ProgramPluginInstallation)
        .filter(models.ProgramPluginInstallation.program_id == semester.program_id, models.ProgramPluginInstallation.plugin_id.in_(canonical_plugin_ids))
        .all()
    )
    installations_by_plugin_id = {installation.plugin_id: installation for installation in installations}
    missing_plugin_id = next((plugin_id for plugin_id in canonical_plugin_ids if plugin_id not in installations_by_plugin_id), None)
    if missing_plugin_id is not None:
        raise PluginRegistryError("PLUGIN_NOT_INSTALLED", f"Plugin '{missing_plugin_id}' is not installed for this Program.")

    activations = (
        db.query(models.SemesterPluginActivation)
        .filter(
            models.SemesterPluginActivation.semester_id == semester_id,
            models.SemesterPluginActivation.program_plugin_installation_id.in_([installation.id for installation in installations]),
        )
        .all()
    )
    activations_by_installation_id = {activation.program_plugin_installation_id: activation for activation in activations}

    now = _now_utc_iso()
    for plugin_id in canonical_plugin_ids:
        installation = installations_by_plugin_id[plugin_id]
        activation = activations_by_installation_id.get(installation.id)
        try:
            definition = plugin_registry.get_plugin_definition(plugin_id)
        except (KeyError, RuntimeError, plugin_registry.PluginRegistryValidationError) as exc:
            _wrap_plugin_validation(exc)
        if not payload.is_enabled and definition.locked:
            raise PluginRegistryError("PLUGIN_LOCKED", f"Plugin '{plugin_id}' is locked and cannot be disabled.")
        available, _, availability_reason = _resolve_program_plugin_availability(semester.program, installation, plugin_id=plugin_id)
        if payload.is_enabled and not available:
            raise PluginRegistryError("PLUGIN_NOT_AVAILABLE", availability_reason or f"Plugin '{plugin_id}' is not available for activation.")
        if activation is None:
            activation = models.SemesterPluginActivation(semester_id=semester_id, program_plugin_installation_id=installation.id, is_enabled=True, created_at=now)
            activations_by_installation_id[installation.id] = activation
        activation.is_enabled = payload.is_enabled
        activation.updated_at = now
        db.add(activation)

    if semester.lifecycle_state == "draft":
        semester.creation_step = "plugins"
        semester.draft_updated_at = now
    _refresh_semester_review_ready(db, semester)
    db.add(semester)
    db.commit()
    db.refresh(semester)
    from crud_academics import _serialize_semester_draft
    return _serialize_semester_draft(semester)


@_with_canonical_plugin_id
def delete_semester_plugin_activation(db: Session, semester_id: str, plugin_id: str) -> models.SemesterPluginActivation | None:
    try:
        definition = plugin_registry.get_plugin_definition(plugin_id)
    except (KeyError, RuntimeError, plugin_registry.PluginRegistryValidationError) as exc:
        _wrap_plugin_validation(exc)
    if definition.locked:
        raise PluginRegistryError("PLUGIN_LOCKED", f"Plugin '{plugin_id}' is locked and cannot be disabled.")
    activation = (
        db.query(models.SemesterPluginActivation)
        .join(models.ProgramPluginInstallation)
        .filter(models.SemesterPluginActivation.semester_id == semester_id, models.ProgramPluginInstallation.plugin_id == plugin_id)
        .first()
    )
    if activation is None:
        return None
    semester = activation.semester
    db.delete(activation)
    if semester is not None:
        if semester.lifecycle_state == "draft":
            semester.draft_updated_at = _now_utc_iso()
        _refresh_semester_review_ready(db, semester)
        db.add(semester)
    db.commit()
    return activation


def get_course_plugin_activations(db: Session, course_id: str) -> list[dict]:
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if course is None:
        return []
    if course.semester_id is not None:
        return get_course_inherited_plugin_activations(db, course_id)
    if course.program is None:
        db.refresh(course, attribute_names=["program"])
    program = course.program
    if program is None:
        raise PluginRegistryError("PROGRAM_NOT_FOUND", "Course is missing its parent Program.")
    _normalize_program_plugin_installations(db, program)
    _ensure_default_program_plugin_installations(db, program)
    activations_by_installation_id = {
        activation.program_plugin_installation_id: activation
        for activation in course.plugin_activations
        if activation.program_plugin_installation_id
    }
    eligible_installations = sorted(
        (
            installation
            for installation in program.plugin_installations
            if installation.is_enabled and not plugin_registry.get_plugin_definition(installation.plugin_id).locked and _supports_unassigned_course(installation.plugin_id)
        ),
        key=lambda item: item.plugin_id,
    )
    return [
        _serialize_course_plugin_activation(course, activations_by_installation_id.get(installation.id), installation=installation, source="course")
        for installation in eligible_installations
    ]


@_with_canonical_plugin_id
def upsert_course_plugin_activation(db: Session, course_id: str, plugin_id: str, payload: schemas.CoursePluginActivationUpsertRequest) -> dict:
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if course is None:
        raise PluginRegistryError("COURSE_NOT_FOUND", "Course not found.")
    if course.semester_id is not None:
        raise PluginRegistryError("COURSE_NOT_UNASSIGNED", "Course-level plugin activation is only available for Courses without a Semester.")
    if course.program_id is None:
        raise PluginRegistryError("PROGRAM_NOT_FOUND", "Course is missing its parent Program.")
    if not _supports_unassigned_course(plugin_id):
        raise PluginRegistryError("PLUGIN_NOT_AVAILABLE", f"Plugin '{plugin_id}' does not support Courses without a Semester.")
    definition = plugin_registry.get_plugin_definition(plugin_id)
    if definition.locked:
        raise PluginRegistryError("PLUGIN_LOCKED", f"Plugin '{plugin_id}' is locked and cannot be managed at the Course level.")
    installation = (
        db.query(models.ProgramPluginInstallation)
        .filter(models.ProgramPluginInstallation.program_id == course.program_id, models.ProgramPluginInstallation.plugin_id == plugin_id)
        .first()
    )
    if installation is None:
        raise PluginRegistryError("PLUGIN_NOT_INSTALLED", f"Plugin '{plugin_id}' is not installed for this Program.")
    activation = (
        db.query(models.ProgramCoursePluginActivation)
        .filter(models.ProgramCoursePluginActivation.course_id == course_id, models.ProgramCoursePluginActivation.program_plugin_installation_id == installation.id)
        .first()
    )
    requested_enabled = payload.is_enabled if payload.is_enabled is not None else (activation.is_enabled if activation is not None else True)
    available, _, availability_reason = _resolve_program_plugin_availability(course.program or installation.program, installation, plugin_id=plugin_id)
    if requested_enabled and not available:
        raise PluginRegistryError("PLUGIN_NOT_AVAILABLE", availability_reason or f"Plugin '{plugin_id}' is not available for activation.")
    now = _now_utc_iso()
    if activation is None:
        activation = models.ProgramCoursePluginActivation(course_id=course_id, program_plugin_installation_id=installation.id, is_enabled=True, created_at=now)
    if payload.is_enabled is not None:
        activation.is_enabled = bool(payload.is_enabled)
    elif activation.is_enabled is None:
        activation.is_enabled = True
    if activation.is_enabled:
        _ensure_course_plugin_tabs(db, course, plugin_id)
    activation.updated_at = now
    db.add(activation)
    db.commit()
    db.refresh(activation)
    return _serialize_course_plugin_activation(course, activation, installation=installation, source="course")


def bulk_update_course_plugin_activations(db: Session, course_id: str, payload: schemas.CoursePluginActivationBulkUpdateRequest) -> list[dict]:
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if course is None:
        raise PluginRegistryError("COURSE_NOT_FOUND", "Course not found.")
    if course.semester_id is not None:
        raise PluginRegistryError("COURSE_NOT_UNASSIGNED", "Course-level plugin activation is only available for Courses without a Semester.")
    if course.program_id is None:
        raise PluginRegistryError("PROGRAM_NOT_FOUND", "Course is missing its parent Program.")
    canonical_plugin_ids: list[str] = []
    seen_plugin_ids: set[str] = set()
    for plugin_id in payload.plugin_ids:
        canonical_plugin_id = _canonical_plugin_id(plugin_id)
        if canonical_plugin_id in seen_plugin_ids:
            continue
        seen_plugin_ids.add(canonical_plugin_id)
        canonical_plugin_ids.append(canonical_plugin_id)
    if not canonical_plugin_ids:
        raise PluginRegistryError("PLUGIN_IDS_REQUIRED", "Provide at least one plugin id.")
    unsupported_plugin_id = next((plugin_id for plugin_id in canonical_plugin_ids if not _supports_unassigned_course(plugin_id)), None)
    if unsupported_plugin_id is not None:
        raise PluginRegistryError("PLUGIN_NOT_AVAILABLE", f"Plugin '{unsupported_plugin_id}' does not support Courses without a Semester.")
    locked_plugin_id = next((plugin_id for plugin_id in canonical_plugin_ids if plugin_registry.get_plugin_definition(plugin_id).locked), None)
    if locked_plugin_id is not None:
        raise PluginRegistryError("PLUGIN_LOCKED", f"Plugin '{locked_plugin_id}' is locked and cannot be managed at the Course level.")

    installations = (
        db.query(models.ProgramPluginInstallation)
        .filter(models.ProgramPluginInstallation.program_id == course.program_id, models.ProgramPluginInstallation.plugin_id.in_(canonical_plugin_ids))
        .all()
    )
    installations_by_plugin_id = {installation.plugin_id: installation for installation in installations}
    missing_plugin_id = next((plugin_id for plugin_id in canonical_plugin_ids if plugin_id not in installations_by_plugin_id), None)
    if missing_plugin_id is not None:
        raise PluginRegistryError("PLUGIN_NOT_INSTALLED", f"Plugin '{missing_plugin_id}' is not installed for this Program.")

    activations = (
        db.query(models.ProgramCoursePluginActivation)
        .filter(
            models.ProgramCoursePluginActivation.course_id == course_id,
            models.ProgramCoursePluginActivation.program_plugin_installation_id.in_([installation.id for installation in installations]),
        )
        .all()
    )
    activations_by_installation_id = {activation.program_plugin_installation_id: activation for activation in activations}

    now = _now_utc_iso()
    for plugin_id in canonical_plugin_ids:
        installation = installations_by_plugin_id[plugin_id]
        activation = activations_by_installation_id.get(installation.id)
        available, _, availability_reason = _resolve_program_plugin_availability(course.program or installation.program, installation, plugin_id=plugin_id)
        if payload.is_enabled and not available:
            raise PluginRegistryError("PLUGIN_NOT_AVAILABLE", availability_reason or f"Plugin '{plugin_id}' is not available for activation.")
        if activation is None:
            activation = models.ProgramCoursePluginActivation(course_id=course_id, program_plugin_installation_id=installation.id, is_enabled=True, created_at=now)
            activations_by_installation_id[installation.id] = activation
        activation.is_enabled = payload.is_enabled
        if activation.is_enabled:
            _ensure_course_plugin_tabs(db, course, plugin_id)
        activation.updated_at = now
        db.add(activation)

    db.commit()
    db.refresh(course)
    return get_course_plugin_activations(db, course_id)


def get_course_inherited_plugin_activations(db: Session, course_id: str) -> list[dict]:
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if course is None or course.semester_id is None:
        return []
    if course.program is None:
        db.refresh(course, attribute_names=["program"])
    if course.program is not None:
        _normalize_program_plugin_installations(db, course.program)
        _ensure_default_program_plugin_installations(db, course.program)
    installations_by_id = {
        installation.id: installation
        for installation in ((course.program.plugin_installations if course.program is not None else []) or [])
    }
    inherited_activations: list[dict] = []
    for activation in get_semester_plugin_activations(db, course.semester_id):
        if not activation.get("is_enabled"):
            continue
        installation = installations_by_id.get(activation["program_plugin_installation_id"])
        if installation is None:
            continue
        inherited_activations.append(
            _serialize_course_plugin_activation(
                course,
                None,
                installation=installation,
                source="semester",
                is_enabled=bool(activation.get("is_enabled")),
                available=bool(activation.get("available")),
                availability_reason=activation.get("availability_reason"),
            )
        )
    return inherited_activations
