# input:  [SQLAlchemy session, backend CRUD/model helpers, plugin management metadata, and JSON parsing helpers]
# output: [runtime payload builders and tab-setting serializers for Program/Semester/Course API routes]
# pos:    [Backend projection helper that assembles surface-aware runtime tabs, widget catalogs, availability payloads, and scope-resolved tab settings outside the FastAPI entrypoint]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from sqlalchemy.orm import Session

import crud
from crud_shared import _parse_json_object
import models
import plugin_registry


def _serialize_runtime_plugin_payloads(
    activations: list[dict],
) -> dict[str, object]:
    runtime_activations = [
        activation
        for activation in activations
        if activation.get("is_enabled") and activation.get("available")
    ]
    enabled_plugin_ids = [activation["plugin_id"] for activation in runtime_activations]
    runtime_plugins = [
        {
            "id": activation["id"],
            "plugin_id": activation["plugin_id"],
            "available_tab_types": list(activation.get("capabilities", {}).get("available_tab_types", [])),
            "available_widget_types": list(activation.get("capabilities", {}).get("available_widget_types", [])),
        }
        for activation in runtime_activations
    ]
    available_widget_types = sorted({
        widget_type
        for activation in runtime_activations
        for widget_type in activation.get("capabilities", {}).get("available_widget_types", [])
    })
    return {
        "enabled_plugin_ids": enabled_plugin_ids,
        "runtime_plugins": runtime_plugins,
        "available_widget_types": available_widget_types,
    }


def _fallback_availability(
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
        "reason_code": reason_code or "not_enabled",
        "reason_message": reason_message or "This contribution is unavailable.",
    }


def _read_activation_availability(activation: dict) -> dict[str, object]:
    availability = activation.get("availability")
    if isinstance(availability, dict) and availability.get("state") in {"available", "unavailable"}:
        return {
            "state": availability.get("state"),
            "reason_code": availability.get("reason_code"),
            "reason_message": availability.get("reason_message"),
        }
    return _fallback_availability(
        available=bool(activation.get("available")),
        reason_message=activation.get("availability_reason"),
    )


def serialize_tab_settings_payloads(
    db: Session,
    *,
    program_id: str | None = None,
    semester_id: str | None = None,
    course_id: str | None = None,
) -> list[dict[str, object]]:
    context_kwargs: dict[str, str] = {}
    if course_id is not None:
        context_kwargs["course_id"] = course_id
    elif semester_id is not None:
        context_kwargs["semester_id"] = semester_id
    elif program_id is not None:
        context_kwargs["program_id"] = program_id
    else:
        raise ValueError("Tab settings serialization requires a concrete Program, Semester, or Course context.")

    payloads: list[dict[str, object]] = []
    for row in crud.get_tab_settings_for_context(db, **context_kwargs):
        settings_metadata = crud.resolve_tab_settings_metadata(
            db,
            row.tab_type,
            program_id=program_id,
            semester_id=semester_id,
            course_id=course_id,
        )
        payloads.append({
            "id": row.id,
            "tab_type": row.tab_type,
            "settings": row.settings,
            "program_id": row.program_id,
            "semester_id": row.semester_id,
            "course_id": row.course_id,
            **settings_metadata,
        })
    return payloads


def serialize_tab_setting_payload(
    db: Session,
    row: models.TabSetting,
    *,
    program_id: str | None = None,
    semester_id: str | None = None,
    course_id: str | None = None,
) -> dict[str, object]:
    settings_metadata = crud.resolve_tab_settings_metadata(
        db,
        row.tab_type,
        program_id=program_id,
        semester_id=semester_id,
        course_id=course_id,
    )
    return {
        "id": row.id,
        "tab_type": row.tab_type,
        "settings": row.settings,
        "program_id": row.program_id,
        "semester_id": row.semester_id,
        "course_id": row.course_id,
        **settings_metadata,
    }


def _format_contribution_title(value: str) -> str:
    return " ".join(
        segment.capitalize()
        for segment in str(value or "").replace(".", "-").split("-")
        if segment
    ) or value


def _read_contribution_allowed_contexts(
    capabilities: dict[str, object],
    *,
    contribution_kind: str,
    contribution_type: str,
) -> list[str]:
    context_map_key = "tab_allowed_contexts" if contribution_kind == "tab" else "widget_allowed_contexts"
    raw_context_map = capabilities.get(context_map_key, {})
    if not isinstance(raw_context_map, dict):
        return []
    raw_allowed_contexts = raw_context_map.get(contribution_type, [])
    if not isinstance(raw_allowed_contexts, list):
        return []
    return [
        str(value).strip()
        for value in raw_allowed_contexts
        if isinstance(value, str) and str(value).strip()
    ]


def _is_contribution_allowed_in_context(
    capabilities: dict[str, object],
    *,
    contribution_kind: str,
    contribution_type: str,
    context_kind: str,
) -> bool:
    return context_kind in set(
        _read_contribution_allowed_contexts(
            capabilities,
            contribution_kind=contribution_kind,
            contribution_type=contribution_type,
        )
    )


def _build_runtime_catalog(
    activations: list[dict],
    *,
    context_kind: str,
) -> tuple[dict[str, dict[str, object]], dict[str, dict[str, object]]]:
    tab_items: dict[str, dict[str, object]] = {}
    widget_items: dict[str, dict[str, object]] = {}

    for activation in activations:
        plugin_id = activation.get("plugin_id")
        availability = _read_activation_availability(activation)
        capabilities = activation.get("capabilities") or {}

        for tab_type in capabilities.get("available_tab_types", []):
            if not isinstance(tab_type, str) or not tab_type or plugin_registry.is_host_reserved_tab_type(tab_type):
                continue
            allowed_contexts = _read_contribution_allowed_contexts(
                capabilities,
                contribution_kind="tab",
                contribution_type=tab_type,
            )
            if not _is_contribution_allowed_in_context(
                capabilities,
                contribution_kind="tab",
                contribution_type=tab_type,
                context_kind=context_kind,
            ):
                continue
            title = _format_contribution_title(tab_type)
            tab_items[tab_type] = {
                "plugin_id": plugin_id,
                "tab_type": tab_type,
                "title": title,
                "display_name": title,
                "description": "",
                "allowed_contexts": allowed_contexts,
                "selected": False,
                "availability": dict(availability),
            }

        for widget_type in capabilities.get("available_widget_types", []):
            if not isinstance(widget_type, str) or not widget_type:
                continue
            allowed_contexts = _read_contribution_allowed_contexts(
                capabilities,
                contribution_kind="widget",
                contribution_type=widget_type,
            )
            if not _is_contribution_allowed_in_context(
                capabilities,
                contribution_kind="widget",
                contribution_type=widget_type,
                context_kind=context_kind,
            ):
                continue
            title = _format_contribution_title(widget_type)
            widget_items[widget_type] = {
                "plugin_id": plugin_id,
                "widget_type": widget_type,
                "title": title,
                "display_name": title,
                "description": "",
                "allowed_contexts": allowed_contexts,
                "max_instances": None,
                "availability": dict(availability),
            }

    return tab_items, widget_items


def _missing_tab_catalog_item(tab_type: str) -> dict[str, object]:
    plugin_id = plugin_registry.get_plugin_id_for_tab_type(tab_type)
    title = _format_contribution_title(tab_type)
    return {
        "plugin_id": plugin_id,
        "tab_type": tab_type,
        "title": title,
        "display_name": title,
        "description": "",
        "allowed_contexts": [],
        "selected": True,
        "availability": _fallback_availability(
            available=False,
            reason_code="not_installed",
            reason_message="The owning plugin is not installed or no longer available.",
        ),
    }


def _build_runtime_tab_payload(
    db: Session,
    *,
    program_id: str,
    activations: list[dict],
    bucket_type: str,
    bucket_semester_id: str | None = None,
    bucket_course_id: str | None = None,
    context_kind: str,
    semester_id: str | None = None,
    course_id: str | None = None,
) -> dict[str, object]:
    runtime_payload = _serialize_runtime_plugin_payloads(activations)
    tab_catalog_map, widget_catalog_map = _build_runtime_catalog(
        activations,
        context_kind=context_kind,
    )
    order_entries = crud.get_workspace_tab_order_entries(
        db,
        bucket_type,
        semester_id=bucket_semester_id,
        course_id=bucket_course_id,
    )
    selected_tab_types = (
        [
            entry.tab_type
            for entry in order_entries
            if entry.tab_type in tab_catalog_map
        ]
        if order_entries
        else [
            tab_type
            for tab_type, catalog_item in tab_catalog_map.items()
            if catalog_item.get("availability", {}).get("state") == "available"
        ]
    )

    runtime_tabs: list[dict[str, object]] = []
    for order_index, tab_type in enumerate(selected_tab_types):
        catalog_item = tab_catalog_map.get(tab_type) or _missing_tab_catalog_item(tab_type)
        catalog_item["selected"] = True
        scoped_setting_kwargs: dict[str, str] = {}
        if course_id is not None:
            scoped_setting_kwargs["course_id"] = course_id
        elif semester_id is not None:
            scoped_setting_kwargs["semester_id"] = semester_id
        scoped_tab_setting = crud.get_tab_setting(
            db,
            tab_type,
            **scoped_setting_kwargs,
        )
        settings_metadata = crud.resolve_tab_settings_metadata(
            db,
            tab_type,
            program_id=program_id,
            semester_id=semester_id,
            course_id=course_id,
        )
        runtime_tabs.append({
            "plugin_id": catalog_item.get("plugin_id"),
            "tab_type": tab_type,
            "title": str(catalog_item.get("title") or tab_type),
            "settings": _parse_json_object(scoped_tab_setting.settings if scoped_tab_setting is not None else None),
            "scope_settings": settings_metadata["scope_settings"],
            "inherited_settings": settings_metadata["inherited_settings"],
            "resolved_settings": settings_metadata["resolved_settings"],
            "setting_sources": settings_metadata["setting_sources"],
            "order_index": order_index,
            "is_removable": True,
            "is_draggable": True,
            "availability": catalog_item["availability"],
        })

    for tab_type, catalog_item in tab_catalog_map.items():
        if tab_type in selected_tab_types:
            continue
        catalog_item["selected"] = False

    ordered_catalog_items = [tab_catalog_map[tab_type] for tab_type in selected_tab_types if tab_type in tab_catalog_map]
    ordered_catalog_items.extend(
        catalog_item
        for tab_type, catalog_item in tab_catalog_map.items()
        if tab_type not in selected_tab_types
    )

    return {
        **runtime_payload,
        "tab_settings": serialize_tab_settings_payloads(
            db,
            program_id=program_id,
            semester_id=semester_id,
            course_id=course_id,
        ),
        "runtime_tabs": runtime_tabs,
        "tab_catalog_items": ordered_catalog_items,
        "widget_catalog_items": list(widget_catalog_map.values()),
    }


def build_semester_runtime_payload(
    db: Session,
    semester: models.Semester,
) -> dict[str, object]:
    plugin_activations = crud.get_semester_plugin_activations(db, semester.id)
    return _build_runtime_tab_payload(
        db,
        program_id=semester.program_id,
        activations=plugin_activations,
        bucket_type=crud.SEMESTER_HOMEPAGE_TAB_ORDER_BUCKET,
        bucket_semester_id=semester.id,
        context_kind="semester",
        semester_id=semester.id,
    )


def build_course_runtime_payload(
    db: Session,
    course: models.Course,
) -> dict[str, object]:
    course_plugin_activations = crud.get_course_plugin_activations(db, course.id)
    bucket_type, bucket_context = crud.get_tab_order_bucket_for_course(course)
    return _build_runtime_tab_payload(
        db,
        program_id=course.program_id,
        activations=course_plugin_activations,
        bucket_type=bucket_type,
        bucket_semester_id=bucket_context.get("semester_id"),
        bucket_course_id=bucket_context.get("course_id"),
        context_kind="course",
        semester_id=course.semester_id,
        course_id=course.id,
    )


def find_runtime_tab(payload: dict[str, object], tab_type: str) -> dict[str, object] | None:
    normalized_tab_type = (tab_type or "").strip()
    for tab_payload in payload.get("runtime_tabs", []):
        if tab_payload.get("tab_type") == normalized_tab_type:
            return tab_payload
    return None
