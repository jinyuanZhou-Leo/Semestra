# input:  [Alembic migration context, JSON helpers, and plugin-governance runtime tables]
# output: [Data migration that renames the historical course-resources plugin ids and contribution types to the canonical builtin-course-resources identity]
# pos:    [Backend data migration for converting persisted course-resources plugin records to the new builtin-course-resources plugin and tab/widget identifiers without runtime alias handling]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""rename course resources plugin identity

Revision ID: 20260413_0025
Revises: 20260407_0024
Create Date: 2026-04-13 14:40:00.000000
"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa


revision = "20260413_0025"
down_revision = "20260407_0024"
branch_labels = None
depends_on = None

OLD_PLUGIN_ID = "course-resources"
NEW_PLUGIN_ID = "builtin-course-resources"

OLD_TAB_TYPES = ("course-resources", "course-resources-tab")
NEW_TAB_TYPE = "builtin-course-resources"

OLD_WIDGET_TYPE = "course-resources-quick-open"
NEW_WIDGET_TYPE = "builtin-course-resources-quick-open"

OLD_SETTINGS_KEYS = ("course-resources", "course-resources-tab")
NEW_SETTINGS_KEY = "builtin-course-resources"


def _fetch_rows(bind: sa.Connection, statement: str, **params: object) -> list[dict[str, object]]:
    return [dict(row._mapping) for row in bind.execute(sa.text(statement), params)]


def _parse_json_object(raw_value: object) -> dict[str, object]:
    if not isinstance(raw_value, str) or not raw_value.strip():
        return {}
    try:
        parsed = json.loads(raw_value)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _serialize_json_object(value: dict[str, object]) -> str:
    return json.dumps(value, sort_keys=True)


def _pick_non_empty(*values: object) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value
    return ""


def _pick_latest_iso(*values: object) -> str:
    normalized = [value for value in values if isinstance(value, str) and value.strip()]
    return max(normalized) if normalized else ""


def _merge_installation_payload(target: dict[str, object], source: dict[str, object]) -> dict[str, object]:
    return {
        "version": _pick_non_empty(target.get("version"), source.get("version"), "workspace"),
        "is_enabled": int(bool(target.get("is_enabled")) or bool(source.get("is_enabled"))),
        "auth_state": _pick_non_empty(
            target.get("auth_state") if str(target.get("auth_state") or "") != "not-required" else "",
            source.get("auth_state") if str(source.get("auth_state") or "") != "not-required" else "",
            target.get("auth_state"),
            source.get("auth_state"),
            "not-required",
        ),
        "auth_message": _pick_non_empty(target.get("auth_message"), source.get("auth_message")),
        "created_at": min(
            [value for value in [target.get("created_at"), source.get("created_at")] if isinstance(value, str) and value.strip()],
            default="",
        ),
        "updated_at": _pick_latest_iso(target.get("updated_at"), source.get("updated_at")),
    }


def _merge_activation_rows(
    bind: sa.Connection,
    *,
    table_name: str,
    scope_column: str,
    old_installation_id: str,
    new_installation_id: str,
) -> None:
    rows = _fetch_rows(
        bind,
        f"""
        SELECT id, {scope_column}, program_plugin_installation_id, is_enabled, created_at, updated_at
        FROM {table_name}
        WHERE program_plugin_installation_id IN (:old_installation_id, :new_installation_id)
        ORDER BY id
        """,
        old_installation_id=old_installation_id,
        new_installation_id=new_installation_id,
    )
    rows_by_scope: dict[str, list[dict[str, object]]] = {}
    for row in rows:
        scope_id = str(row.get(scope_column) or "")
        rows_by_scope.setdefault(scope_id, []).append(row)

    for scoped_rows in rows_by_scope.values():
        canonical_row = next(
            (row for row in scoped_rows if str(row.get("program_plugin_installation_id") or "") == new_installation_id),
            None,
        )
        if canonical_row is None:
            canonical_row = scoped_rows[0]
            bind.execute(
                sa.text(f"UPDATE {table_name} SET program_plugin_installation_id = :installation_id WHERE id = :row_id"),
                {"installation_id": new_installation_id, "row_id": str(canonical_row.get("id") or "")},
            )

        for row in scoped_rows:
            row_id = str(row.get("id") or "")
            if row_id == str(canonical_row.get("id") or ""):
                continue
            merged_is_enabled = int(bool(canonical_row.get("is_enabled")) or bool(row.get("is_enabled")))
            merged_created_at = min(
                [value for value in [canonical_row.get("created_at"), row.get("created_at")] if isinstance(value, str) and value.strip()],
                default="",
            )
            merged_updated_at = _pick_latest_iso(canonical_row.get("updated_at"), row.get("updated_at"))
            bind.execute(
                sa.text(
                    f"""
                    UPDATE {table_name}
                    SET is_enabled = :is_enabled,
                        created_at = :created_at,
                        updated_at = :updated_at
                    WHERE id = :row_id
                    """
                ),
                {
                    "is_enabled": merged_is_enabled,
                    "created_at": merged_created_at,
                    "updated_at": merged_updated_at,
                    "row_id": str(canonical_row.get("id") or ""),
                },
            )
            canonical_row["is_enabled"] = merged_is_enabled
            canonical_row["created_at"] = merged_created_at
            canonical_row["updated_at"] = merged_updated_at
            bind.execute(sa.text(f"DELETE FROM {table_name} WHERE id = :row_id"), {"row_id": row_id})


def _rename_program_plugin_installations(bind: sa.Connection) -> None:
    rows = _fetch_rows(
        bind,
        """
        SELECT id, program_id, plugin_id, version, is_enabled, auth_state, auth_message, created_at, updated_at
        FROM program_plugin_installations
        WHERE plugin_id IN (:old_plugin_id, :new_plugin_id)
        ORDER BY created_at, id
        """,
        old_plugin_id=OLD_PLUGIN_ID,
        new_plugin_id=NEW_PLUGIN_ID,
    )
    rows_by_program: dict[str, list[dict[str, object]]] = {}
    for row in rows:
        rows_by_program.setdefault(str(row.get("program_id") or ""), []).append(row)

    for scoped_rows in rows_by_program.values():
        canonical_row = next((row for row in scoped_rows if row.get("plugin_id") == NEW_PLUGIN_ID), None)
        if canonical_row is None:
            canonical_row = scoped_rows[0]
            bind.execute(
                sa.text("UPDATE program_plugin_installations SET plugin_id = :plugin_id WHERE id = :row_id"),
                {"plugin_id": NEW_PLUGIN_ID, "row_id": str(canonical_row.get("id") or "")},
            )
            canonical_row["plugin_id"] = NEW_PLUGIN_ID

        for row in scoped_rows:
            row_id = str(row.get("id") or "")
            canonical_id = str(canonical_row.get("id") or "")
            if row_id == canonical_id:
                continue

            _merge_activation_rows(
                bind,
                table_name="semester_plugin_activations",
                scope_column="semester_id",
                old_installation_id=row_id,
                new_installation_id=canonical_id,
            )
            _merge_activation_rows(
                bind,
                table_name="program_course_plugin_activations",
                scope_column="course_id",
                old_installation_id=row_id,
                new_installation_id=canonical_id,
            )

            merged_payload = _merge_installation_payload(canonical_row, row)
            bind.execute(
                sa.text(
                    """
                    UPDATE program_plugin_installations
                    SET version = :version,
                        is_enabled = :is_enabled,
                        auth_state = :auth_state,
                        auth_message = :auth_message,
                        created_at = :created_at,
                        updated_at = :updated_at
                    WHERE id = :row_id
                    """
                ),
                {**merged_payload, "row_id": canonical_id},
            )
            canonical_row.update(merged_payload)
            bind.execute(
                sa.text("DELETE FROM program_plugin_installations WHERE id = :row_id"),
                {"row_id": row_id},
            )


def _rename_tab_settings(bind: sa.Connection) -> None:
    rows = _fetch_rows(
        bind,
        """
        SELECT id, settings_key, settings, program_id, semester_id, course_id
        FROM tab_settings
        WHERE settings_key = :old_settings_key_one
           OR settings_key = :old_settings_key_two
           OR settings_key = :new_settings_key
        ORDER BY id
        """,
        old_settings_key_one=OLD_SETTINGS_KEYS[0],
        old_settings_key_two=OLD_SETTINGS_KEYS[1],
        new_settings_key=NEW_SETTINGS_KEY,
    )
    rows_by_scope: dict[tuple[str, str], list[dict[str, object]]] = {}
    for row in rows:
        if row.get("program_id"):
            scope = ("program", str(row.get("program_id")))
        elif row.get("semester_id"):
            scope = ("semester", str(row.get("semester_id")))
        else:
            scope = ("course", str(row.get("course_id")))
        rows_by_scope.setdefault(scope, []).append(row)

    for scoped_rows in rows_by_scope.values():
        canonical_row = next((row for row in scoped_rows if row.get("settings_key") == NEW_SETTINGS_KEY), None)
        if canonical_row is None:
            canonical_row = scoped_rows[0]
            bind.execute(
                sa.text("UPDATE tab_settings SET settings_key = :settings_key WHERE id = :row_id"),
                {"settings_key": NEW_SETTINGS_KEY, "row_id": str(canonical_row.get("id") or "")},
            )
            canonical_row["settings_key"] = NEW_SETTINGS_KEY

        canonical_settings = _parse_json_object(canonical_row.get("settings"))
        for row in scoped_rows:
            row_id = str(row.get("id") or "")
            if row_id == str(canonical_row.get("id") or ""):
                continue
            merged_settings = {
                **_parse_json_object(row.get("settings")),
                **canonical_settings,
            }
            bind.execute(
                sa.text("UPDATE tab_settings SET settings = :settings WHERE id = :row_id"),
                {"settings": _serialize_json_object(merged_settings), "row_id": str(canonical_row.get("id") or "")},
            )
            canonical_settings = merged_settings
            bind.execute(sa.text("DELETE FROM tab_settings WHERE id = :row_id"), {"row_id": row_id})


def _rename_tabs(bind: sa.Connection) -> None:
    rows = _fetch_rows(
        bind,
        """
        SELECT id, tab_type, settings, order_index, is_removable, is_draggable, semester_id, course_id
        FROM tabs
        WHERE tab_type = :old_tab_type_one
           OR tab_type = :old_tab_type_two
           OR tab_type = :new_tab_type
        ORDER BY order_index, id
        """,
        old_tab_type_one=OLD_TAB_TYPES[0],
        old_tab_type_two=OLD_TAB_TYPES[1],
        new_tab_type=NEW_TAB_TYPE,
    )
    rows_by_scope: dict[tuple[str, str], list[dict[str, object]]] = {}
    for row in rows:
        if row.get("semester_id"):
            scope = ("semester", str(row.get("semester_id")))
        else:
            scope = ("course", str(row.get("course_id")))
        rows_by_scope.setdefault(scope, []).append(row)

    for scoped_rows in rows_by_scope.values():
        canonical_row = next((row for row in scoped_rows if row.get("tab_type") == NEW_TAB_TYPE), None)
        if canonical_row is None:
            canonical_row = scoped_rows[0]
            bind.execute(
                sa.text("UPDATE tabs SET tab_type = :tab_type WHERE id = :row_id"),
                {"tab_type": NEW_TAB_TYPE, "row_id": str(canonical_row.get("id") or "")},
            )
            canonical_row["tab_type"] = NEW_TAB_TYPE

        canonical_settings = _parse_json_object(canonical_row.get("settings"))
        canonical_order_index = int(canonical_row.get("order_index") or 0)
        canonical_is_removable = bool(canonical_row.get("is_removable"))
        canonical_is_draggable = bool(canonical_row.get("is_draggable"))

        for row in scoped_rows:
            row_id = str(row.get("id") or "")
            if row_id == str(canonical_row.get("id") or ""):
                continue
            canonical_settings = {
                **_parse_json_object(row.get("settings")),
                **canonical_settings,
            }
            canonical_order_index = min(canonical_order_index, int(row.get("order_index") or 0))
            canonical_is_removable = canonical_is_removable or bool(row.get("is_removable"))
            canonical_is_draggable = canonical_is_draggable or bool(row.get("is_draggable"))
            bind.execute(sa.text("DELETE FROM tabs WHERE id = :row_id"), {"row_id": row_id})

        bind.execute(
            sa.text(
                """
                UPDATE tabs
                SET settings = :settings,
                    order_index = :order_index,
                    is_removable = :is_removable,
                    is_draggable = :is_draggable
                WHERE id = :row_id
                """
            ),
            {
                "settings": _serialize_json_object(canonical_settings),
                "order_index": canonical_order_index,
                "is_removable": int(canonical_is_removable),
                "is_draggable": int(canonical_is_draggable),
                "row_id": str(canonical_row.get("id") or ""),
            },
        )


def _rename_widgets(bind: sa.Connection) -> None:
    bind.execute(
        sa.text(
            """
            UPDATE widgets
            SET widget_type = :new_widget_type
            WHERE widget_type = :old_widget_type
            """
        ),
        {"new_widget_type": NEW_WIDGET_TYPE, "old_widget_type": OLD_WIDGET_TYPE},
    )


def _rename_workspace_tab_orders(bind: sa.Connection) -> None:
    rows = _fetch_rows(
        bind,
        """
        SELECT id, bucket_type, tab_type, order_index, semester_id, course_id
        FROM workspace_tab_order_entries
        WHERE tab_type = :old_tab_type_one
           OR tab_type = :old_tab_type_two
           OR tab_type = :new_tab_type
        ORDER BY order_index, id
        """,
        old_tab_type_one=OLD_TAB_TYPES[0],
        old_tab_type_two=OLD_TAB_TYPES[1],
        new_tab_type=NEW_TAB_TYPE,
    )
    rows_by_scope: dict[tuple[str, str, str], list[dict[str, object]]] = {}
    for row in rows:
        scope_id = str(row.get("semester_id") or row.get("course_id") or "")
        rows_by_scope.setdefault((str(row.get("bucket_type") or ""), "semester" if row.get("semester_id") else "course", scope_id), []).append(row)

    for scoped_rows in rows_by_scope.values():
        canonical_row = next((row for row in scoped_rows if row.get("tab_type") == NEW_TAB_TYPE), None)
        if canonical_row is None:
            canonical_row = scoped_rows[0]
            bind.execute(
                sa.text("UPDATE workspace_tab_order_entries SET tab_type = :tab_type WHERE id = :row_id"),
                {"tab_type": NEW_TAB_TYPE, "row_id": str(canonical_row.get("id") or "")},
            )
            canonical_row["tab_type"] = NEW_TAB_TYPE

        canonical_order_index = min(int(row.get("order_index") or 0) for row in scoped_rows)
        for row in scoped_rows:
            row_id = str(row.get("id") or "")
            if row_id == str(canonical_row.get("id") or ""):
                continue
            bind.execute(sa.text("DELETE FROM workspace_tab_order_entries WHERE id = :row_id"), {"row_id": row_id})

        bind.execute(
            sa.text("UPDATE workspace_tab_order_entries SET order_index = :order_index WHERE id = :row_id"),
            {"order_index": canonical_order_index, "row_id": str(canonical_row.get("id") or "")},
        )

    all_rows = _fetch_rows(
        bind,
        """
        SELECT id, bucket_type, order_index, semester_id, course_id
        FROM workspace_tab_order_entries
        ORDER BY bucket_type, semester_id, course_id, order_index, id
        """
    )
    rows_by_bucket: dict[tuple[str, str], list[dict[str, object]]] = {}
    for row in all_rows:
        scope_id = str(row.get("semester_id") or row.get("course_id") or "")
        rows_by_bucket.setdefault((str(row.get("bucket_type") or ""), scope_id), []).append(row)

    for scoped_rows in rows_by_bucket.values():
        for index, row in enumerate(scoped_rows):
            bind.execute(
                sa.text("UPDATE workspace_tab_order_entries SET order_index = :order_index WHERE id = :row_id"),
                {"order_index": index, "row_id": str(row.get("id") or "")},
            )


def upgrade() -> None:
    bind = op.get_bind()
    _rename_program_plugin_installations(bind)
    _rename_tab_settings(bind)
    _rename_tabs(bind)
    _rename_widgets(bind)
    _rename_workspace_tab_orders(bind)


def downgrade() -> None:
    raise RuntimeError("Downgrade is not supported for the course resources identity rename migration.")
