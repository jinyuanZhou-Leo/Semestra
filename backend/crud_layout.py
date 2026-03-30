# input:  [SQLAlchemy session, ORM models, layout schemas, plugin definitions, and shared CRUD normalization helpers]
# output: [context guards, legacy tab normalization helpers, widget/tab CRUD, V2 tab-settings persistence, and workspace-tab-order bucket helpers]
# pos:    [Layout/persistence slice of backend CRUD that owns widgets, legacy tabs, V2 tab-settings ownership, and workspace-tab ordering across Program/Semester/Course workspaces]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import plugin_governance
import schemas
from crud_shared import _canonical_tab_type, _parse_json_object, _serialize_json_object


HOST_RESERVED_TAB_TYPES = {"builtin-dashboard", "builtin-setting"}
SEMESTER_HOMEPAGE_TAB_ORDER_BUCKET = "semester_homepage"
SEMESTER_COURSE_SHARED_TAB_ORDER_BUCKET = "semester_course_shared"
UNASSIGNED_COURSE_HOMEPAGE_TAB_ORDER_BUCKET = "unassigned_course_homepage"


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


def ensure_semester_tabs_normalized(db: Session, semester: models.Semester) -> None:
    _normalize_context_tabs(db, semester=semester)


def ensure_course_tabs_normalized(db: Session, course: models.Course) -> None:
    _normalize_context_tabs(db, course=course)


def _ensure_widget_context(semester_id: str | None, course_id: str | None):
    if (semester_id is None and course_id is None) or (semester_id is not None and course_id is not None):
        raise ValueError("Widget must be attached to exactly one context (semester_id or course_id).")


def _ensure_tab_context(semester_id: str | None, course_id: str | None):
    if (semester_id is None and course_id is None) or (semester_id is not None and course_id is not None):
        raise ValueError("Tab must be attached to exactly one context (semester_id or course_id).")


def _get_next_tab_order(db: Session, semester_id: str | None, course_id: str | None) -> int:
    query = db.query(func.max(models.Tab.order_index))
    if semester_id:
        query = query.filter(models.Tab.semester_id == semester_id)
    if course_id:
        query = query.filter(models.Tab.course_id == course_id)
    max_order = query.scalar()
    return int(max_order or 0) + 1


def _ensure_course_plugin_tabs(
    db: Session,
    course: models.Course,
    plugin_id: str,
) -> None:
    available_tab_types = []
    definition = plugin_governance.get_plugin_definition(plugin_id)
    for raw_tab_type in definition.capabilities.get("available_tab_types", []):
        canonical_tab_type = _canonical_tab_type(raw_tab_type)
        if canonical_tab_type:
            available_tab_types.append(canonical_tab_type)
    if not available_tab_types:
        return

    existing_tab_types = {
        tab_type
        for (tab_type,) in (
            db.query(models.Tab.tab_type)
            .filter(
                models.Tab.course_id == course.id,
                models.Tab.tab_type.in_(available_tab_types),
            )
            .all()
        )
        if tab_type
    }
    next_order_index = _get_next_tab_order(db, None, course.id)

    for tab_type in available_tab_types:
        if tab_type in existing_tab_types:
            continue
        db.add(
            models.Tab(
                tab_type=tab_type,
                settings="{}",
                semester_id=None,
                course_id=course.id,
                order_index=next_order_index,
                is_removable=True,
                is_draggable=True,
            )
        )
        existing_tab_types.add(tab_type)
        next_order_index += 1


def _ensure_tab_settings_context(
    program_id: str | None = None,
    semester_id: str | None = None,
    course_id: str | None = None,
) -> None:
    populated = [value for value in (program_id, semester_id, course_id) if value is not None]
    if len(populated) != 1:
        raise ValueError("Tab settings must be attached to exactly one context (program_id, semester_id, or course_id).")


def _ensure_tab_order_context(
    bucket_type: str,
    *,
    semester_id: str | None = None,
    course_id: str | None = None,
) -> None:
    if bucket_type in {SEMESTER_HOMEPAGE_TAB_ORDER_BUCKET, SEMESTER_COURSE_SHARED_TAB_ORDER_BUCKET}:
        if semester_id is None or course_id is not None:
            raise ValueError(f"{bucket_type} must use semester_id only.")
        return
    if bucket_type == UNASSIGNED_COURSE_HOMEPAGE_TAB_ORDER_BUCKET:
        if course_id is None or semester_id is not None:
            raise ValueError(f"{bucket_type} must use course_id only.")
        return
    raise ValueError(f"Unsupported tab order bucket '{bucket_type}'.")


def get_tab_order_bucket_for_semester(semester_id: str) -> tuple[str, dict[str, str]]:
    return SEMESTER_HOMEPAGE_TAB_ORDER_BUCKET, {"semester_id": semester_id}


def get_tab_order_bucket_for_course(course: models.Course) -> tuple[str, dict[str, str]]:
    if course.semester_id:
        return SEMESTER_COURSE_SHARED_TAB_ORDER_BUCKET, {"semester_id": course.semester_id}
    return UNASSIGNED_COURSE_HOMEPAGE_TAB_ORDER_BUCKET, {"course_id": course.id}


def get_workspace_tab_order_entries(
    db: Session,
    bucket_type: str,
    *,
    semester_id: str | None = None,
    course_id: str | None = None,
) -> list[models.WorkspaceTabOrderEntry]:
    _ensure_tab_order_context(bucket_type, semester_id=semester_id, course_id=course_id)
    query = db.query(models.WorkspaceTabOrderEntry).filter(models.WorkspaceTabOrderEntry.bucket_type == bucket_type)
    if semester_id is not None:
        query = query.filter(models.WorkspaceTabOrderEntry.semester_id == semester_id)
    if course_id is not None:
        query = query.filter(models.WorkspaceTabOrderEntry.course_id == course_id)
    return query.order_by(models.WorkspaceTabOrderEntry.order_index.asc(), models.WorkspaceTabOrderEntry.id.asc()).all()


def set_workspace_tab_order(
    db: Session,
    bucket_type: str,
    tab_types: list[str],
    *,
    semester_id: str | None = None,
    course_id: str | None = None,
) -> list[models.WorkspaceTabOrderEntry]:
    _ensure_tab_order_context(bucket_type, semester_id=semester_id, course_id=course_id)
    normalized_tab_types: list[str] = []
    seen_tab_types: set[str] = set()
    for raw_tab_type in tab_types:
        tab_type = _canonical_tab_type(raw_tab_type)
        if not tab_type or tab_type in HOST_RESERVED_TAB_TYPES or tab_type in seen_tab_types:
            continue
        seen_tab_types.add(tab_type)
        normalized_tab_types.append(tab_type)

    query = db.query(models.WorkspaceTabOrderEntry).filter(models.WorkspaceTabOrderEntry.bucket_type == bucket_type)
    if semester_id is not None:
        query = query.filter(models.WorkspaceTabOrderEntry.semester_id == semester_id)
    if course_id is not None:
        query = query.filter(models.WorkspaceTabOrderEntry.course_id == course_id)
    query.delete(synchronize_session=False)

    entries: list[models.WorkspaceTabOrderEntry] = []
    for order_index, tab_type in enumerate(normalized_tab_types):
        entry = models.WorkspaceTabOrderEntry(
            bucket_type=bucket_type,
            tab_type=tab_type,
            order_index=order_index,
            semester_id=semester_id,
            course_id=course_id,
        )
        db.add(entry)
        entries.append(entry)

    db.commit()
    return get_workspace_tab_order_entries(db, bucket_type, semester_id=semester_id, course_id=course_id)


def add_workspace_tab_selection(
    db: Session,
    bucket_type: str,
    tab_type: str,
    *,
    semester_id: str | None = None,
    course_id: str | None = None,
) -> models.WorkspaceTabOrderEntry | None:
    _ensure_tab_order_context(bucket_type, semester_id=semester_id, course_id=course_id)
    normalized_tab_type = _canonical_tab_type(tab_type)
    if not normalized_tab_type or normalized_tab_type in HOST_RESERVED_TAB_TYPES:
        return None
    existing = get_workspace_tab_order_entries(
        db,
        bucket_type,
        semester_id=semester_id,
        course_id=course_id,
    )
    for entry in existing:
        if entry.tab_type == normalized_tab_type:
            return entry

    next_order_index = len(existing)
    entry = models.WorkspaceTabOrderEntry(
        bucket_type=bucket_type,
        tab_type=normalized_tab_type,
        order_index=next_order_index,
        semester_id=semester_id,
        course_id=course_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def remove_workspace_tab_selection(
    db: Session,
    bucket_type: str,
    tab_type: str,
    *,
    semester_id: str | None = None,
    course_id: str | None = None,
) -> bool:
    _ensure_tab_order_context(bucket_type, semester_id=semester_id, course_id=course_id)
    normalized_tab_type = _canonical_tab_type(tab_type)
    entry = (
        db.query(models.WorkspaceTabOrderEntry)
        .filter(
            models.WorkspaceTabOrderEntry.bucket_type == bucket_type,
            models.WorkspaceTabOrderEntry.tab_type == normalized_tab_type,
            models.WorkspaceTabOrderEntry.semester_id == semester_id,
            models.WorkspaceTabOrderEntry.course_id == course_id,
        )
        .first()
    )
    if entry is None:
        return False
    db.delete(entry)
    db.flush()
    remaining_entries = get_workspace_tab_order_entries(
        db,
        bucket_type,
        semester_id=semester_id,
        course_id=course_id,
    )
    for order_index, remaining_entry in enumerate(remaining_entries):
        remaining_entry.order_index = order_index
        db.add(remaining_entry)
    db.commit()
    return True


def get_tab_settings_for_context(
    db: Session,
    *,
    program_id: str | None = None,
    semester_id: str | None = None,
    course_id: str | None = None,
) -> list[models.TabSetting]:
    _ensure_tab_settings_context(program_id=program_id, semester_id=semester_id, course_id=course_id)
    query = db.query(models.TabSetting)
    if program_id is not None:
        query = query.filter(models.TabSetting.program_id == program_id)
    if semester_id is not None:
        query = query.filter(models.TabSetting.semester_id == semester_id)
    if course_id is not None:
        query = query.filter(models.TabSetting.course_id == course_id)
    return query.order_by(models.TabSetting.tab_type.asc()).all()


def get_tab_setting(
    db: Session,
    tab_type: str,
    *,
    program_id: str | None = None,
    semester_id: str | None = None,
    course_id: str | None = None,
) -> models.TabSetting | None:
    _ensure_tab_settings_context(program_id=program_id, semester_id=semester_id, course_id=course_id)
    query = db.query(models.TabSetting).filter(models.TabSetting.tab_type == _canonical_tab_type(tab_type))
    if program_id is not None:
        query = query.filter(models.TabSetting.program_id == program_id)
    if semester_id is not None:
        query = query.filter(models.TabSetting.semester_id == semester_id)
    if course_id is not None:
        query = query.filter(models.TabSetting.course_id == course_id)
    return query.first()


def upsert_tab_setting(
    db: Session,
    tab_setting: schemas.TabSettingCreate,
    *,
    program_id: str | None = None,
    semester_id: str | None = None,
    course_id: str | None = None,
) -> models.TabSetting:
    _ensure_tab_settings_context(program_id=program_id, semester_id=semester_id, course_id=course_id)
    normalized_tab_type = _canonical_tab_type(tab_setting.tab_type)
    existing = get_tab_setting(
        db,
        normalized_tab_type,
        program_id=program_id,
        semester_id=semester_id,
        course_id=course_id,
    )
    if existing is None:
        existing = models.TabSetting(
            tab_type=normalized_tab_type,
            program_id=program_id,
            semester_id=semester_id,
            course_id=course_id,
        )
    existing.settings = tab_setting.settings
    db.add(existing)
    db.commit()
    db.refresh(existing)
    return existing


def resolve_tab_settings(
    db: Session,
    tab_type: str,
    *,
    program_id: str | None = None,
    semester_id: str | None = None,
    course_id: str | None = None,
) -> dict:
    normalized_tab_type = _canonical_tab_type(tab_type)
    resolved: dict = {}
    if program_id is not None:
        program_setting = get_tab_setting(db, normalized_tab_type, program_id=program_id)
        resolved.update(_parse_json_object(program_setting.settings if program_setting is not None else None))
    if semester_id is not None:
        semester_setting = get_tab_setting(db, normalized_tab_type, semester_id=semester_id)
        resolved.update(_parse_json_object(semester_setting.settings if semester_setting is not None else None))
    if course_id is not None:
        course_setting = get_tab_setting(db, normalized_tab_type, course_id=course_id)
        resolved.update(_parse_json_object(course_setting.settings if course_setting is not None else None))
    return resolved


def list_tab_settings_payloads(
    db: Session,
    *,
    program_id: str | None = None,
    semester_id: str | None = None,
    course_id: str | None = None,
) -> list[dict]:
    rows = get_tab_settings_for_context(
        db,
        program_id=program_id,
        semester_id=semester_id,
        course_id=course_id,
    )
    return [
        {
            "id": row.id,
            "tab_type": row.tab_type,
            "settings": row.settings,
            "program_id": row.program_id,
            "semester_id": row.semester_id,
            "course_id": row.course_id,
        }
        for row in rows
    ]


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
