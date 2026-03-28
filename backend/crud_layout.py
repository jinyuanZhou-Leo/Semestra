# input:  [SQLAlchemy session, ORM models, layout/plugin-setting schemas, plugin definitions, and shared CRUD normalization helpers]
# output: [context guards, tab normalization helpers, widget/tab/plugin-setting CRUD, and auto-created course-plugin tab helpers]
# pos:    [Layout/persistence slice of backend CRUD that owns widgets, tabs, plugin settings, and tab-shape normalization across Semester/Course workspaces]
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
from crud_shared import _canonical_tab_type


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


def _ensure_plugin_settings_context(semester_id: str | None, course_id: str | None):
    if (semester_id is None and course_id is None) or (semester_id is not None and course_id is not None):
        raise ValueError("Plugin settings must be attached to exactly one context (semester_id or course_id).")


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
