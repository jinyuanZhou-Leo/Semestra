# input:  [Alembic migration context, SQLite row helpers, and checked-in plugin registry metadata]
# output: [Data migration that repairs stale legacy Semester homepage tab-order rows so they match the current runtime Semester tab set]
# pos:    [Backend data migration for cleaning legacy semester_homepage order entries that dropped available Semester runtime tabs during the Plugin System V2 backfill]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

"""repair legacy semester homepage tab orders

Revision ID: 20260407_0024
Revises: 20260404_0023
Create Date: 2026-04-07 12:10:00.000000
"""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import sys
import uuid

from alembic import op
import sqlalchemy as sa


BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import plugin_registry


revision = "20260407_0024"
down_revision = "20260404_0023"
branch_labels = None
depends_on = None

SEMESTER_HOMEPAGE_TAB_ORDER_BUCKET = "semester_homepage"


def _make_id() -> str:
    return str(uuid.uuid4())


def _has_table(bind: sa.Connection, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in set(inspector.get_table_names())


def _fetch_rows(bind: sa.Connection, statement: str) -> list[dict[str, object]]:
    return [dict(row._mapping) for row in bind.execute(sa.text(statement))]


def _normalize_tab_type_sequence(rows: list[dict[str, object]]) -> list[str]:
    normalized_tab_types: list[str] = []
    seen_tab_types: set[str] = set()
    for row in sorted(rows, key=lambda item: (int(item.get("order_index") or 0), str(item.get("id") or ""))):
        tab_type = str(row.get("tab_type") or "").strip()
        if not tab_type or tab_type in seen_tab_types:
            continue
        seen_tab_types.add(tab_type)
        normalized_tab_types.append(tab_type)
    return normalized_tab_types


def _list_available_semester_tab_types(
    *,
    semester_id: str,
    program_id: str,
    program_has_lms_integration: bool,
    installations_by_program_id: dict[str, list[dict[str, object]]],
    activations_by_semester_id: dict[str, dict[str, dict[str, object]]],
) -> list[str]:
    available_tab_types: list[str] = []
    seen_tab_types: set[str] = set()
    activation_rows_by_installation_id = activations_by_semester_id.get(semester_id, {})

    for installation in sorted(installations_by_program_id.get(program_id, []), key=lambda item: str(item.get("plugin_id") or "")):
        plugin_id = plugin_registry.normalize_plugin_id(str(installation.get("plugin_id") or ""))
        if not plugin_id or not bool(installation.get("is_enabled")):
            continue

        activation = activation_rows_by_installation_id.get(str(installation.get("id") or ""))
        if activation is None or not bool(activation.get("is_enabled")):
            continue

        available, _ = plugin_registry.resolve_plugin_availability(
            plugin_id,
            program_has_lms_integration=program_has_lms_integration,
            auth_state=str(installation.get("auth_state") or "not-required"),
        )
        if not available:
            continue

        definition = plugin_registry.get_plugin_definition(plugin_id)
        capabilities = definition.capabilities or {}
        raw_context_map = capabilities.get("tab_allowed_contexts", {})
        tab_allowed_contexts = raw_context_map if isinstance(raw_context_map, dict) else {}

        for raw_tab_type in capabilities.get("available_tab_types", []):
            tab_type = str(raw_tab_type or "").strip()
            if not tab_type or plugin_registry.is_host_reserved_tab_type(tab_type):
                continue
            allowed_contexts = tab_allowed_contexts.get(tab_type, [])
            if "semester" not in allowed_contexts:
                continue
            if tab_type in seen_tab_types:
                continue
            seen_tab_types.add(tab_type)
            available_tab_types.append(tab_type)

    return available_tab_types


def _merge_valid_existing_order(
    current_tab_types: list[str],
    expected_tab_types: list[str],
) -> list[str]:
    desired_tab_types = [tab_type for tab_type in current_tab_types if tab_type in expected_tab_types]
    desired_tab_types.extend(tab_type for tab_type in expected_tab_types if tab_type not in desired_tab_types)
    return desired_tab_types


def _replace_workspace_tab_order_entries(
    bind: sa.Connection,
    *,
    semester_id: str,
    tab_types: list[str],
) -> None:
    bind.execute(
        sa.text(
            """
            DELETE FROM workspace_tab_order_entries
            WHERE bucket_type = :bucket_type
              AND semester_id = :semester_id
            """
        ),
        {
            "bucket_type": SEMESTER_HOMEPAGE_TAB_ORDER_BUCKET,
            "semester_id": semester_id,
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
                    NULL
                )
                """
            ),
            {
                "id": _make_id(),
                "bucket_type": SEMESTER_HOMEPAGE_TAB_ORDER_BUCKET,
                "tab_type": tab_type,
                "order_index": order_index,
                "semester_id": semester_id,
            },
        )


def repair_legacy_semester_homepage_tab_orders(bind: sa.Connection) -> None:
    required_tables = {
        "programs",
        "semesters",
        "program_plugin_installations",
        "semester_plugin_activations",
        "workspace_tab_order_entries",
    }
    if any(not _has_table(bind, table_name) for table_name in required_tables):
        return

    semester_rows = _fetch_rows(bind, "SELECT id, program_id FROM semesters")
    program_rows = _fetch_rows(bind, "SELECT id, lms_integration_id FROM programs")
    installation_rows = _fetch_rows(
        bind,
        """
        SELECT id, program_id, plugin_id, is_enabled, auth_state
        FROM program_plugin_installations
        """,
    )
    activation_rows = _fetch_rows(
        bind,
        """
        SELECT id, semester_id, program_plugin_installation_id, is_enabled
        FROM semester_plugin_activations
        """,
    )
    tab_order_rows = _fetch_rows(
        bind,
        """
        SELECT id, semester_id, tab_type, order_index
        FROM workspace_tab_order_entries
        WHERE bucket_type = 'semester_homepage'
        """,
    )

    programs_by_id = {str(row["id"]): row for row in program_rows}
    installations_by_program_id: dict[str, list[dict[str, object]]] = defaultdict(list)
    activations_by_semester_id: dict[str, dict[str, dict[str, object]]] = defaultdict(dict)
    tab_order_rows_by_semester_id: dict[str, list[dict[str, object]]] = defaultdict(list)

    for row in installation_rows:
        program_id = str(row.get("program_id") or "").strip()
        if program_id:
            installations_by_program_id[program_id].append(row)

    for row in activation_rows:
        semester_id = str(row.get("semester_id") or "").strip()
        installation_id = str(row.get("program_plugin_installation_id") or "").strip()
        if semester_id and installation_id:
            activations_by_semester_id[semester_id][installation_id] = row

    for row in tab_order_rows:
        semester_id = str(row.get("semester_id") or "").strip()
        if semester_id:
            tab_order_rows_by_semester_id[semester_id].append(row)

    for semester_row in semester_rows:
        semester_id = str(semester_row.get("id") or "").strip()
        program_id = str(semester_row.get("program_id") or "").strip()
        current_rows = tab_order_rows_by_semester_id.get(semester_id, [])
        if not semester_id or not program_id or not current_rows:
            continue

        program_row = programs_by_id.get(program_id)
        if program_row is None:
            continue

        current_tab_types = _normalize_tab_type_sequence(current_rows)
        expected_tab_types = _list_available_semester_tab_types(
            semester_id=semester_id,
            program_id=program_id,
            program_has_lms_integration=bool(program_row.get("lms_integration_id")),
            installations_by_program_id=installations_by_program_id,
            activations_by_semester_id=activations_by_semester_id,
        )
        desired_tab_types = _merge_valid_existing_order(current_tab_types, expected_tab_types)

        if current_tab_types == desired_tab_types:
            continue

        _replace_workspace_tab_order_entries(
            bind,
            semester_id=semester_id,
            tab_types=desired_tab_types,
        )


def upgrade() -> None:
    repair_legacy_semester_homepage_tab_orders(op.get_bind())


def downgrade() -> None:
    pass
