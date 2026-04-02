# input:  [unittest, in-memory SQLAlchemy engine, and backend schema drift checks]
# output: [backend regression tests for startup-time runtime schema compatibility validation]
# pos:    [backend unit tests for failing fast when a database is head-stamped but structurally missing required runtime columns]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import unittest
from pathlib import Path
import sys

from sqlalchemy import create_engine

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database import assert_runtime_schema_compatible, collect_runtime_schema_issues


class RuntimeSchemaCompatibilityTests(unittest.TestCase):
    def test_collect_runtime_schema_issues_reports_missing_review_ready_column(self) -> None:
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        with engine.begin() as connection:
            connection.exec_driver_sql(
                """
                CREATE TABLE users (
                    id VARCHAR NOT NULL PRIMARY KEY,
                    email_verified_at VARCHAR
                )
                """
            )
            connection.exec_driver_sql(
                """
                CREATE TABLE email_verification_challenges (
                    id VARCHAR NOT NULL PRIMARY KEY,
                    email VARCHAR,
                    purpose VARCHAR,
                    code_hash VARCHAR,
                    verification_nonce VARCHAR,
                    attempt_count INTEGER,
                    max_attempts INTEGER,
                    expires_at VARCHAR,
                    last_sent_at VARCHAR,
                    verified_at VARCHAR,
                    used_at VARCHAR,
                    invalidated_at VARCHAR,
                    resend_email_id VARCHAR,
                    request_ip VARCHAR,
                    user_agent VARCHAR,
                    created_at VARCHAR,
                    updated_at VARCHAR
                )
                """
            )
            connection.exec_driver_sql(
                """
                CREATE TABLE semesters (
                    id VARCHAR NOT NULL PRIMARY KEY,
                    name VARCHAR,
                    program_id VARCHAR,
                    start_date DATE NOT NULL,
                    end_date DATE NOT NULL,
                    reading_week_start DATE,
                    reading_week_end DATE,
                    average_percentage FLOAT,
                    average_scaled FLOAT,
                    lifecycle_state VARCHAR DEFAULT 'active' NOT NULL,
                    creation_step VARCHAR DEFAULT 'review' NOT NULL,
                    draft_updated_at VARCHAR
                )
                """
            )
            connection.exec_driver_sql(
                """
                CREATE TABLE widgets (
                    id VARCHAR NOT NULL PRIMARY KEY,
                    title VARCHAR DEFAULT '' NOT NULL
                )
                """
            )
            connection.exec_driver_sql(
                """
                CREATE TABLE program_plugin_installations (
                    id VARCHAR NOT NULL PRIMARY KEY,
                    program_id VARCHAR NOT NULL,
                    plugin_id VARCHAR NOT NULL,
                    version VARCHAR NOT NULL,
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
                    setup_state TEXT NOT NULL,
                    is_enabled BOOLEAN NOT NULL
                )
                """
            )

        issues = collect_runtime_schema_issues(engine)

        self.assertEqual(
            issues,
            [
                "missing table 'program_course_plugin_activations'",
                "missing table 'tab_settings'",
                "missing table 'workspace_tab_order_entries'",
                "missing column 'semesters.review_ready'",
            ],
        )

    def test_assert_runtime_schema_compatible_raises_clear_error(self) -> None:
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        with self.assertRaises(RuntimeError) as context:
            assert_runtime_schema_compatible(engine)

        message = str(context.exception)
        self.assertIn("Database schema is incompatible", message)
        self.assertIn("uv run alembic -c alembic.ini upgrade head", message)


if __name__ == "__main__":
    unittest.main()
