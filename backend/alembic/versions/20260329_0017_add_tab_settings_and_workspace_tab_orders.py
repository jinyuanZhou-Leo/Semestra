# input:  [Alembic migration context and SQLAlchemy schema inspection helpers]
# output: [Schema migration that adds V2 tab-settings storage, workspace tab-order buckets, and legacy settings backfills for Program plus assigned-Course scopes]
# pos:    [Backend schema migration for Plugin System V2 tab-owned settings and host-managed tab selection ordering, including program-installation and course-override backfills]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""add tab settings and workspace tab orders

Revision ID: 20260329_0017
Revises: 20260328_0016
Create Date: 2026-03-29 12:30:00.000000
"""

from __future__ import annotations

from collections import defaultdict
import json
from pathlib import Path
import uuid

from alembic import op
import sqlalchemy as sa


revision = "20260329_0017"
down_revision = "20260328_0016"
branch_labels = None
depends_on = None

HOST_RESERVED_PLUGIN_IDS = {"builtin-dashboard", "builtin-setting"}
HOST_RESERVED_TAB_TYPES = {"builtin-dashboard", "builtin-setting"}
TAB_TYPE_ALIASES = {"builtin-settings": "builtin-setting"}
SEMESTER_HOMEPAGE_TAB_ORDER_BUCKET = "semester_homepage"
SEMESTER_COURSE_SHARED_TAB_ORDER_BUCKET = "semester_course_shared"
UNASSIGNED_COURSE_HOMEPAGE_TAB_ORDER_BUCKET = "unassigned_course_homepage"


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in set(inspector.get_table_names())


def _has_index(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def _make_id() -> str:
    return str(uuid.uuid4())


def _canonical_tab_type(tab_type: str | None) -> str:
    normalized = (tab_type or "").strip()
    return TAB_TYPE_ALIASES.get(normalized, normalized)


def _parse_json_object(raw_value: object) -> dict[str, object]:
    if isinstance(raw_value, dict):
        return dict(raw_value)
    if isinstance(raw_value, str):
        normalized = raw_value.strip()
        if not normalized:
            return {}
        try:
            parsed = json.loads(normalized)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Invalid JSON payload encountered during plugin-system V2 migration: {normalized}") from exc
        if isinstance(parsed, dict):
            return parsed
    return {}


def _serialize_json_object(value: dict[str, object]) -> str:
    return json.dumps(value, ensure_ascii=True, separators=(",", ":"), sort_keys=True)


def _merge_json_objects(*values: object) -> dict[str, object]:
    merged: dict[str, object] = {}
    for value in values:
        merged.update(_parse_json_object(value))
    return merged


def _load_single_tab_plugin_map() -> dict[str, str]:
    authoring_root = Path(__file__).resolve().parents[3] / "frontend" / "src" / "plugins"
    descriptor_root = Path(__file__).resolve().parents[3] / "backend" / "generated" / "plugin-manifests"
    host_policy_path = authoring_root / "host-policy.json"
    host_policy = json.loads(host_policy_path.read_text(encoding="utf-8")) if host_policy_path.exists() else {}
    single_tab_plugin_map: dict[str, str] = {}
    for descriptor_path in sorted(descriptor_root.glob("*.plugin.json")):
        item = json.loads(descriptor_path.read_text(encoding="utf-8"))
        plugin_id = str(item.get("id") or "").strip()
        if not plugin_id:
            continue
        policy = host_policy.get(plugin_id) if isinstance(host_policy, dict) else None
        if isinstance(policy, dict) and str(policy.get("kind") or "").strip() == "host-shell":
            continue
        available_tab_types = [
            _canonical_tab_type(raw_type)
            for raw_tab in item.get("tabs", [])
            if isinstance(raw_tab, dict)
            for raw_type in [raw_tab.get("type")]
            if _canonical_tab_type(raw_type) and _canonical_tab_type(raw_type) not in HOST_RESERVED_TAB_TYPES
        ]
        if len(available_tab_types) == 1:
            single_tab_plugin_map[plugin_id] = available_tab_types[0]
    return single_tab_plugin_map


def _fetch_rows(bind: sa.Connection, statement: str) -> list[dict[str, object]]:
    return [dict(row._mapping) for row in bind.execute(sa.text(statement))]


def _upsert_tab_setting(
    bind: sa.Connection,
    *,
    tab_type: str,
    settings: dict[str, object],
    program_id: str | None = None,
    semester_id: str | None = None,
    course_id: str | None = None,
) -> None:
    if not settings:
        return

    existing = bind.execute(
        sa.text(
            """
            SELECT id, settings
            FROM tab_settings
            WHERE tab_type = :tab_type
              AND ((:program_id IS NOT NULL AND program_id = :program_id)
                OR (:semester_id IS NOT NULL AND semester_id = :semester_id)
                OR (:course_id IS NOT NULL AND course_id = :course_id))
            """
        ),
        {
            "tab_type": tab_type,
            "program_id": program_id,
            "semester_id": semester_id,
            "course_id": course_id,
        },
    ).mappings().first()

    merged_settings = _merge_json_objects(existing["settings"] if existing else None, settings)
    serialized_settings = _serialize_json_object(merged_settings)

    if existing:
        bind.execute(
            sa.text("UPDATE tab_settings SET settings = :settings WHERE id = :id"),
            {"id": existing["id"], "settings": serialized_settings},
        )
        return

    bind.execute(
        sa.text(
            """
            INSERT INTO tab_settings (id, tab_type, settings, program_id, semester_id, course_id)
            VALUES (:id, :tab_type, :settings, :program_id, :semester_id, :course_id)
            """
        ),
        {
            "id": _make_id(),
            "tab_type": tab_type,
            "settings": serialized_settings,
            "program_id": program_id,
            "semester_id": semester_id,
            "course_id": course_id,
        },
    )


def _replace_workspace_tab_order_entries(
    bind: sa.Connection,
    *,
    bucket_type: str,
    tab_types: list[str],
    semester_id: str | None = None,
    course_id: str | None = None,
) -> None:
    bind.execute(
        sa.text(
            """
            DELETE FROM workspace_tab_order_entries
            WHERE bucket_type = :bucket_type
              AND ((:semester_id IS NOT NULL AND semester_id = :semester_id)
                OR (:course_id IS NOT NULL AND course_id = :course_id))
            """
        ),
        {
            "bucket_type": bucket_type,
            "semester_id": semester_id,
            "course_id": course_id,
        },
    )

    for order_index, tab_type in enumerate(tab_types):
        bind.execute(
            sa.text(
                """
                INSERT INTO workspace_tab_order_entries (
                    id,
                    bucket_type,
                    tab_type,
                    order_index,
                    semester_id,
                    course_id
                ) VALUES (
                    :id,
                    :bucket_type,
                    :tab_type,
                    :order_index,
                    :semester_id,
                    :course_id
                )
                """
            ),
            {
                "id": _make_id(),
                "bucket_type": bucket_type,
                "tab_type": tab_type,
                "order_index": order_index,
                "semester_id": semester_id,
                "course_id": course_id,
            },
        )


def _normalize_selected_tab_types(
    rows: list[dict[str, object]],
    *,
    context_label: str,
) -> list[str]:
    ordered_tab_types: list[str] = []
    seen_tab_types: set[str] = set()
    for row in sorted(rows, key=lambda item: (int(item.get("order_index") or 0), str(item.get("id") or ""))):
        tab_type = _canonical_tab_type(str(row.get("tab_type") or ""))
        if not tab_type or tab_type in HOST_RESERVED_TAB_TYPES:
            continue
        if tab_type in seen_tab_types:
            raise RuntimeError(
                f"{context_label} contains duplicate tab type '{tab_type}', which cannot be migrated to the V2 singleton tab model."
            )
        seen_tab_types.add(tab_type)
        ordered_tab_types.append(tab_type)
    return ordered_tab_types


def _build_context_tab_settings(
    *,
    plugin_settings_rows: list[dict[str, object]],
    tab_rows: list[dict[str, object]],
    single_tab_plugin_map: dict[str, str],
    context_label: str,
) -> dict[str, dict[str, object]]:
    settings_by_tab_type: dict[str, dict[str, object]] = {}

    for row in plugin_settings_rows:
        plugin_id = str(row.get("plugin_id") or "").strip()
        if not plugin_id or plugin_id in HOST_RESERVED_PLUGIN_IDS:
            continue
        if plugin_id == "course-list":
            continue

        mapped_tab_type = single_tab_plugin_map.get(plugin_id)
        plugin_settings = _parse_json_object(row.get("settings"))
        if mapped_tab_type is None:
            if plugin_settings:
                raise RuntimeError(
                    f"{context_label} has shared settings for multi-tab or widget-only plugin '{plugin_id}', and the migration has no explicit tab mapping."
                )
            continue

        settings_by_tab_type[mapped_tab_type] = _merge_json_objects(
            settings_by_tab_type.get(mapped_tab_type),
            plugin_settings,
        )

    for row in tab_rows:
        tab_type = _canonical_tab_type(str(row.get("tab_type") or ""))
        if not tab_type or tab_type in HOST_RESERVED_TAB_TYPES:
            continue
        settings_by_tab_type[tab_type] = _merge_json_objects(
            settings_by_tab_type.get(tab_type),
            row.get("settings"),
        )

    return settings_by_tab_type


def _migrate_course_list_widget_settings(
    bind: sa.Connection,
    plugin_settings_rows: list[dict[str, object]],
) -> None:
    widget_rows = _fetch_rows(
        bind,
        """
        SELECT id, semester_id, settings
        FROM widgets
        WHERE widget_type = 'course-list' AND semester_id IS NOT NULL
        """,
    )
    widgets_by_semester: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in widget_rows:
        widgets_by_semester[str(row["semester_id"])].append(row)

    for row in plugin_settings_rows:
        if str(row.get("plugin_id") or "").strip() != "course-list":
            continue

        semester_id = str(row.get("semester_id") or "").strip()
        if not semester_id:
            continue

        semester_widgets = widgets_by_semester.get(semester_id, [])
        if not semester_widgets:
            continue
        if len(semester_widgets) > 1:
            raise RuntimeError(
                f"Semester '{semester_id}' has multiple 'course-list' widgets. Migration cannot determine the singleton widget instance."
            )

        widget_row = semester_widgets[0]
        merged_settings = _merge_json_objects(widget_row.get("settings"), row.get("settings"))
        bind.execute(
            sa.text("UPDATE widgets SET settings = :settings WHERE id = :id"),
            {
                "id": widget_row["id"],
                "settings": _serialize_json_object(merged_settings),
            },
        )


def _backfill_v2_runtime_state(bind: sa.Connection) -> None:
    single_tab_plugin_map = _load_single_tab_plugin_map()
    inspector = sa.inspect(bind)

    program_rows = _fetch_rows(bind, "SELECT id FROM programs")
    semester_rows = _fetch_rows(bind, "SELECT id, program_id FROM semesters")
    course_rows = _fetch_rows(bind, "SELECT id, program_id, semester_id FROM courses")
    tab_rows = _fetch_rows(
        bind,
        """
        SELECT id, tab_type, settings, order_index, semester_id, course_id
        FROM tabs
        ORDER BY order_index, id
        """,
    )
    plugin_settings_rows = (
        _fetch_rows(
            bind,
            """
            SELECT id, plugin_id, settings, semester_id, course_id
            FROM plugin_settings
            """
        )
        if _has_table(inspector, "plugin_settings")
        else []
    )
    program_installation_rows = _fetch_rows(
        bind,
        """
        SELECT id, plugin_id, program_settings AS settings, program_id
        FROM program_plugin_installations
        """
    )

    semester_tabs_by_id: dict[str, list[dict[str, object]]] = defaultdict(list)
    course_tabs_by_id: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in tab_rows:
        semester_id = str(row.get("semester_id") or "").strip()
        course_id = str(row.get("course_id") or "").strip()
        if semester_id:
            semester_tabs_by_id[semester_id].append(row)
        elif course_id:
            course_tabs_by_id[course_id].append(row)

    semester_plugin_settings_by_id: dict[str, list[dict[str, object]]] = defaultdict(list)
    course_plugin_settings_by_id: dict[str, list[dict[str, object]]] = defaultdict(list)
    program_installations_by_program_id: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in plugin_settings_rows:
        semester_id = str(row.get("semester_id") or "").strip()
        course_id = str(row.get("course_id") or "").strip()
        if semester_id:
            semester_plugin_settings_by_id[semester_id].append(row)
        elif course_id:
            course_plugin_settings_by_id[course_id].append(row)
    for row in program_installation_rows:
        program_id = str(row.get("program_id") or "").strip()
        if program_id:
            program_installations_by_program_id[program_id].append(row)

    _migrate_course_list_widget_settings(bind, plugin_settings_rows)

    for program_row in program_rows:
        program_id = str(program_row["id"])
        settings_by_tab_type = _build_context_tab_settings(
            plugin_settings_rows=program_installations_by_program_id.get(program_id, []),
            tab_rows=[],
            single_tab_plugin_map=single_tab_plugin_map,
            context_label=f"program '{program_id}'",
        )
        for tab_type, settings in settings_by_tab_type.items():
            _upsert_tab_setting(bind, tab_type=tab_type, settings=settings, program_id=program_id)

    for semester_row in semester_rows:
        semester_id = str(semester_row["id"])
        selected_tab_types = _normalize_selected_tab_types(
            semester_tabs_by_id.get(semester_id, []),
            context_label=f"semester '{semester_id}'",
        )
        _replace_workspace_tab_order_entries(
            bind,
            bucket_type=SEMESTER_HOMEPAGE_TAB_ORDER_BUCKET,
            tab_types=selected_tab_types,
            semester_id=semester_id,
        )

        settings_by_tab_type = _build_context_tab_settings(
            plugin_settings_rows=semester_plugin_settings_by_id.get(semester_id, []),
            tab_rows=semester_tabs_by_id.get(semester_id, []),
            single_tab_plugin_map=single_tab_plugin_map,
            context_label=f"semester '{semester_id}'",
        )
        for tab_type, settings in settings_by_tab_type.items():
            _upsert_tab_setting(bind, tab_type=tab_type, settings=settings, semester_id=semester_id)

    assigned_course_ids_by_semester: dict[str, list[str]] = defaultdict(list)
    unassigned_course_ids: list[str] = []
    for course_row in course_rows:
        course_id = str(course_row["id"])
        semester_id = str(course_row.get("semester_id") or "").strip()
        if semester_id:
            assigned_course_ids_by_semester[semester_id].append(course_id)
        else:
            unassigned_course_ids.append(course_id)

    for course_id in unassigned_course_ids:
        selected_tab_types = _normalize_selected_tab_types(
            course_tabs_by_id.get(course_id, []),
            context_label=f"unassigned course '{course_id}'",
        )
        _replace_workspace_tab_order_entries(
            bind,
            bucket_type=UNASSIGNED_COURSE_HOMEPAGE_TAB_ORDER_BUCKET,
            tab_types=selected_tab_types,
            course_id=course_id,
        )
        settings_by_tab_type = _build_context_tab_settings(
            plugin_settings_rows=course_plugin_settings_by_id.get(course_id, []),
            tab_rows=course_tabs_by_id.get(course_id, []),
            single_tab_plugin_map=single_tab_plugin_map,
            context_label=f"unassigned course '{course_id}'",
        )
        for tab_type, settings in settings_by_tab_type.items():
            _upsert_tab_setting(bind, tab_type=tab_type, settings=settings, course_id=course_id)

    for semester_id, course_ids in assigned_course_ids_by_semester.items():
        expected_tab_order: tuple[str, ...] | None = None

        for course_id in sorted(course_ids):
            selected_tab_types = tuple(
                _normalize_selected_tab_types(
                    course_tabs_by_id.get(course_id, []),
                    context_label=f"assigned course '{course_id}'",
                )
            )
            settings_by_tab_type = _build_context_tab_settings(
                plugin_settings_rows=course_plugin_settings_by_id.get(course_id, []),
                tab_rows=course_tabs_by_id.get(course_id, []),
                single_tab_plugin_map=single_tab_plugin_map,
                context_label=f"assigned course '{course_id}'",
            )
            if expected_tab_order is None:
                expected_tab_order = selected_tab_types
            elif selected_tab_types != expected_tab_order:
                raise RuntimeError(
                    f"Semester '{semester_id}' has assigned courses with divergent tab selection/order. Resolve the inconsistency before running Plugin System V2 migration."
                )
            for tab_type, settings in settings_by_tab_type.items():
                _upsert_tab_setting(bind, tab_type=tab_type, settings=settings, course_id=course_id)

        _replace_workspace_tab_order_entries(
            bind,
            bucket_type=SEMESTER_COURSE_SHARED_TAB_ORDER_BUCKET,
            tab_types=list(expected_tab_order or ()),
            semester_id=semester_id,
        )


def _cleanup_host_reserved_runtime_rows(bind: sa.Connection) -> None:
    bind.execute(
        sa.text(
            """
            DELETE FROM tabs
            WHERE tab_type IN ('builtin-dashboard', 'builtin-setting', 'builtin-settings')
            """
        )
    )
    if "plugin_settings" in set(sa.inspect(bind).get_table_names()):
        bind.execute(
            sa.text(
                """
                DELETE FROM plugin_settings
                WHERE plugin_id IN ('builtin-dashboard', 'builtin-setting')
                """
            )
        )
    bind.execute(
        sa.text(
            """
            DELETE FROM program_plugin_installations
            WHERE plugin_id IN ('builtin-dashboard', 'builtin-setting')
            """
        )
    )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_table(inspector, "tab_settings"):
        op.create_table(
            "tab_settings",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("tab_type", sa.String(), nullable=False),
            sa.Column("settings", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("program_id", sa.String(), nullable=True),
            sa.Column("semester_id", sa.String(), nullable=True),
            sa.Column("course_id", sa.String(), nullable=True),
            sa.CheckConstraint(
                """
                (
                    (program_id IS NOT NULL AND semester_id IS NULL AND course_id IS NULL)
                    OR (program_id IS NULL AND semester_id IS NOT NULL AND course_id IS NULL)
                    OR (program_id IS NULL AND semester_id IS NULL AND course_id IS NOT NULL)
                )
                """,
                name="ck_tab_settings_single_context",
            ),
            sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["semester_id"], ["semesters.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("tab_type", "program_id", name="uq_tab_settings_tab_program"),
            sa.UniqueConstraint("tab_type", "semester_id", name="uq_tab_settings_tab_semester"),
            sa.UniqueConstraint("tab_type", "course_id", name="uq_tab_settings_tab_course"),
        )
        op.create_index("ix_tab_settings_program", "tab_settings", ["program_id"], unique=False)
        op.create_index("ix_tab_settings_semester", "tab_settings", ["semester_id"], unique=False)
        op.create_index("ix_tab_settings_course", "tab_settings", ["course_id"], unique=False)
        op.create_index("ix_tab_settings_tab_type", "tab_settings", ["tab_type"], unique=False)

    inspector = sa.inspect(bind)
    if not _has_table(inspector, "workspace_tab_order_entries"):
        op.create_table(
            "workspace_tab_order_entries",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("bucket_type", sa.String(), nullable=False),
            sa.Column("tab_type", sa.String(), nullable=False),
            sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("semester_id", sa.String(), nullable=True),
            sa.Column("course_id", sa.String(), nullable=True),
            sa.CheckConstraint(
                """
                (
                    semester_id IS NOT NULL
                    AND course_id IS NULL
                    AND bucket_type IN ('semester_homepage', 'semester_course_shared')
                )
                OR (
                    semester_id IS NULL
                    AND course_id IS NOT NULL
                    AND bucket_type = 'unassigned_course_homepage'
                )
                """,
                name="ck_workspace_tab_order_entries_bucket_context",
            ),
            sa.ForeignKeyConstraint(["semester_id"], ["semesters.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "bucket_type",
                "semester_id",
                "tab_type",
                name="uq_workspace_tab_orders_semester_tab",
            ),
            sa.UniqueConstraint(
                "bucket_type",
                "course_id",
                "tab_type",
                name="uq_workspace_tab_orders_course_tab",
            ),
            sa.UniqueConstraint(
                "bucket_type",
                "semester_id",
                "order_index",
                name="uq_workspace_tab_orders_semester_order",
            ),
            sa.UniqueConstraint(
                "bucket_type",
                "course_id",
                "order_index",
                name="uq_workspace_tab_orders_course_order",
            ),
        )
        op.create_index(
            "ix_workspace_tab_orders_semester",
            "workspace_tab_order_entries",
            ["semester_id"],
            unique=False,
        )
        op.create_index(
            "ix_workspace_tab_orders_course",
            "workspace_tab_order_entries",
            ["course_id"],
            unique=False,
        )
        op.create_index(
            "ix_workspace_tab_orders_bucket",
            "workspace_tab_order_entries",
            ["bucket_type"],
            unique=False,
        )

    _backfill_v2_runtime_state(bind)
    _cleanup_host_reserved_runtime_rows(bind)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_table(inspector, "workspace_tab_order_entries"):
        if _has_index(inspector, "workspace_tab_order_entries", "ix_workspace_tab_orders_bucket"):
            op.drop_index("ix_workspace_tab_orders_bucket", table_name="workspace_tab_order_entries")
        if _has_index(inspector, "workspace_tab_order_entries", "ix_workspace_tab_orders_course"):
            op.drop_index("ix_workspace_tab_orders_course", table_name="workspace_tab_order_entries")
        if _has_index(inspector, "workspace_tab_order_entries", "ix_workspace_tab_orders_semester"):
            op.drop_index("ix_workspace_tab_orders_semester", table_name="workspace_tab_order_entries")
        op.drop_table("workspace_tab_order_entries")

    inspector = sa.inspect(bind)
    if _has_table(inspector, "tab_settings"):
        if _has_index(inspector, "tab_settings", "ix_tab_settings_tab_type"):
            op.drop_index("ix_tab_settings_tab_type", table_name="tab_settings")
        if _has_index(inspector, "tab_settings", "ix_tab_settings_course"):
            op.drop_index("ix_tab_settings_course", table_name="tab_settings")
        if _has_index(inspector, "tab_settings", "ix_tab_settings_semester"):
            op.drop_index("ix_tab_settings_semester", table_name="tab_settings")
        if _has_index(inspector, "tab_settings", "ix_tab_settings_program"):
            op.drop_index("ix_tab_settings_program", table_name="tab_settings")
        op.drop_table("tab_settings")
