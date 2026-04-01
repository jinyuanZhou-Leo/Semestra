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


if __name__ == "__main__":
    unittest.main()
