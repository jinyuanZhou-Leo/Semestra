# input:  [unittest and the Plugin System V2 Alembic migration helper functions]
# output: [backend regression tests for legacy assigned-course tab-order reconciliation during migration]
# pos:    [backend unit tests that verify the V2 tab-order migration self-heals duplicate and divergent legacy course tab rows]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


MIGRATION_PATH = (
    Path(__file__).resolve().parent
    / "alembic"
    / "versions"
    / "20260329_0017_add_tab_settings_and_workspace_tab_orders.py"
)
SPEC = importlib.util.spec_from_file_location("migration_20260329_0017", MIGRATION_PATH)
assert SPEC is not None and SPEC.loader is not None
MIGRATION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MIGRATION)

REPAIR_MIGRATION_PATH = (
    Path(__file__).resolve().parent
    / "alembic"
    / "versions"
    / "20260407_0024_repair_legacy_semester_homepage_tab_orders.py"
)
REPAIR_SPEC = importlib.util.spec_from_file_location("migration_20260407_0024", REPAIR_MIGRATION_PATH)
assert REPAIR_SPEC is not None and REPAIR_SPEC.loader is not None
REPAIR_MIGRATION = importlib.util.module_from_spec(REPAIR_SPEC)
REPAIR_SPEC.loader.exec_module(REPAIR_MIGRATION)

from sqlalchemy import create_engine

class TabOrderMigrationTests(unittest.TestCase):
    def test_normalize_selected_tab_types_keeps_first_duplicate_only(self) -> None:
        rows = [
            {"id": "1", "tab_type": "builtin-dashboard", "order_index": 0},
            {"id": "2", "tab_type": "builtin-gradebook", "order_index": 1},
            {"id": "3", "tab_type": "builtin-gradebook", "order_index": 2},
            {"id": "4", "tab_type": "builtin-course-schedule", "order_index": 3},
        ]

        selected_tab_types = MIGRATION._normalize_selected_tab_types(rows, context_label="course 'abc'")

        self.assertEqual(
            selected_tab_types,
            ["builtin-gradebook", "builtin-course-schedule"],
        )

    def test_merge_assigned_course_tab_orders_builds_shared_union_order(self) -> None:
        merged_tab_order = MIGRATION._merge_assigned_course_tab_orders(
            [
                ("builtin-canvas-integration", "builtin-gradebook", "builtin-course-schedule", "builtin-todo"),
                ("builtin-canvas-integration", "builtin-gradebook", "builtin-todo"),
                ("builtin-gradebook", "builtin-course-schedule", "course-resources-tab"),
            ]
        )

        self.assertEqual(
            merged_tab_order,
            [
                "builtin-gradebook",
                "builtin-canvas-integration",
                "builtin-course-schedule",
                "builtin-todo",
                "course-resources-tab",
            ],
        )

    def test_repair_legacy_semester_homepage_orders_appends_missing_runtime_tabs(self) -> None:
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        with engine.begin() as connection:
            connection.exec_driver_sql(
                """
                CREATE TABLE programs (
                    id VARCHAR NOT NULL PRIMARY KEY,
                    lms_integration_id VARCHAR
                )
                """
            )
            connection.exec_driver_sql(
                """
                CREATE TABLE semesters (
                    id VARCHAR NOT NULL PRIMARY KEY,
                    program_id VARCHAR NOT NULL
                )
                """
            )
            connection.exec_driver_sql(
                """
                CREATE TABLE program_plugin_installations (
                    id VARCHAR NOT NULL PRIMARY KEY,
                    program_id VARCHAR NOT NULL,
                    plugin_id VARCHAR NOT NULL,
                    is_enabled BOOLEAN NOT NULL,
                    auth_state VARCHAR NOT NULL
                )
                """
            )
            connection.exec_driver_sql(
                """
                CREATE TABLE semester_plugin_activations (
                    id VARCHAR NOT NULL PRIMARY KEY,
                    semester_id VARCHAR NOT NULL,
                    program_plugin_installation_id VARCHAR NOT NULL,
                    is_enabled BOOLEAN NOT NULL
                )
                """
            )
            connection.exec_driver_sql(
                """
                CREATE TABLE workspace_tab_order_entries (
                    id VARCHAR NOT NULL PRIMARY KEY,
                    bucket_type VARCHAR NOT NULL,
                    tab_type VARCHAR NOT NULL,
                    order_index INTEGER NOT NULL,
                    semester_id VARCHAR,
                    course_id VARCHAR
                )
                """
            )

            connection.exec_driver_sql(
                "INSERT INTO programs (id, lms_integration_id) VALUES ('program-1', NULL)"
            )
            connection.exec_driver_sql(
                "INSERT INTO semesters (id, program_id) VALUES ('semester-1', 'program-1')"
            )
            connection.exec_driver_sql(
                """
                INSERT INTO program_plugin_installations (id, program_id, plugin_id, is_enabled, auth_state)
                VALUES ('installation-1', 'program-1', 'builtin-event-core', 1, 'not-required')
                """
            )
            connection.exec_driver_sql(
                """
                INSERT INTO semester_plugin_activations (id, semester_id, program_plugin_installation_id, is_enabled)
                VALUES ('activation-1', 'semester-1', 'installation-1', 1)
                """
            )
            connection.exec_driver_sql(
                """
                INSERT INTO workspace_tab_order_entries (id, bucket_type, tab_type, order_index, semester_id, course_id)
                VALUES
                    ('order-1', 'semester_homepage', 'builtin-todo', 0, 'semester-1', NULL),
                    ('order-2', 'semester_homepage', 'course-list', 1, 'semester-1', NULL)
                """
            )

            REPAIR_MIGRATION.repair_legacy_semester_homepage_tab_orders(connection)

            repaired_rows = connection.exec_driver_sql(
                """
                SELECT tab_type, order_index
                FROM workspace_tab_order_entries
                WHERE bucket_type = 'semester_homepage' AND semester_id = 'semester-1'
                ORDER BY order_index ASC, id ASC
                """
            ).fetchall()

        self.assertEqual(
            repaired_rows,
            [
                ("builtin-todo", 0),
                ("builtin-academic-calendar", 1),
            ],
        )


if __name__ == "__main__":
    unittest.main()
