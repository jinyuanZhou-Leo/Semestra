# input:  [unittest, tempfile, in-memory SQLAlchemy setup, auth route handlers, account-deletion schema validation, UI workspace ORM models, and local course-resource file persistence]
# output: [backend regression tests for irreversible account deletion across relational data, auth metadata, stored files, and workspace UI records, including the exact confirmation sentence contract]
# pos:    [backend unit tests covering typed account-deletion confirmation-sentence validation, cookie-clearing response behavior, and hard deletion of owned user data plus related workspace records]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

import asyncio
from datetime import date
import tempfile
import unittest
from pathlib import Path
import sys
from unittest.mock import patch

from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.requests import Request

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import api_auth
import auth
import course_resources
import crud
import models
import schemas
from database import Base


class AccountDeletionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = testing_session_local()
        self.temp_dir = tempfile.TemporaryDirectory()
        self.base_dir = Path(self.temp_dir.name)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        self.temp_dir.cleanup()

    def _build_authenticated_delete_request(self) -> Request:
        return Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/users/me/delete-account",
                "headers": [
                    (b"origin", b"http://localhost:5173"),
                    (auth.AUTH_CSRF_HEADER_NAME.lower().encode("utf-8"), b"csrf-token"),
                    (
                        b"cookie",
                        (
                            f"{auth.AUTH_COOKIE_NAME}=session-token; "
                            f"{auth.AUTH_CSRF_COOKIE_NAME}=csrf-token"
                        ).encode("utf-8"),
                    ),
                ],
                "client": ("127.0.0.1", 12345),
            }
        )

    def test_delete_account_request_requires_exact_confirmation_text(self) -> None:
        with self.assertRaises(ValidationError):
            schemas.DeleteAccountRequest(confirmation_text="I confirm deleting account")

    def test_delete_account_removes_owned_data_and_clears_cookie(self) -> None:
        user = crud.create_user(
            self.db,
            schemas.UserCreate(email="delete-me@example.com", nickname="Delete", password="Password123"),
            email_verified_at="2026-03-31T00:00:00+00:00",
        )
        user_email = user.email

        integration = models.LmsIntegration(
            user_id=user.id,
            display_name="Canvas",
            provider="canvas",
            status="connected",
            config_json="{}",
            credentials_encrypted="secret",
            created_at="2026-03-31T00:00:00+00:00",
            updated_at="2026-03-31T00:00:00+00:00",
        )
        self.db.add(integration)
        self.db.commit()
        self.db.refresh(integration)

        program = models.Program(name="Engineering", owner_id=user.id)
        self.db.add(program)
        self.db.commit()
        self.db.refresh(program)

        semester = models.Semester(
            name="Winter 2026",
            program_id=program.id,
            start_date=date(2026, 1, 5),
            end_date=date(2026, 4, 20),
        )
        self.db.add(semester)
        self.db.commit()
        self.db.refresh(semester)

        course = models.Course(
            name="MIE100",
            program_id=program.id,
            semester_id=semester.id,
        )
        self.db.add(course)
        self.db.commit()
        self.db.refresh(course)

        self.db.add_all(
            [
                models.Widget(widget_type="semester-dashboard", title="Semester", semester_id=semester.id),
                models.Widget(widget_type="course-dashboard", title="Course", course_id=course.id),
                models.Tab(tab_type="semester-overview", semester_id=semester.id),
                models.Tab(tab_type="course-overview", course_id=course.id),
                models.TabSetting(tab_type="program-settings", program_id=program.id, settings="{}"),
                models.TabSetting(tab_type="semester-settings", semester_id=semester.id, settings="{}"),
                models.TabSetting(tab_type="course-settings", course_id=course.id, settings="{}"),
                models.WorkspaceTabOrderEntry(
                    bucket_type="semester_homepage",
                    tab_type="semester-overview",
                    order_index=0,
                    semester_id=semester.id,
                ),
                models.WorkspaceTabOrderEntry(
                    bucket_type="unassigned_course_homepage",
                    tab_type="course-overview",
                    order_index=0,
                    course_id=course.id,
                ),
            ]
        )
        self.db.commit()

        resource = course_resources.create_course_resource(
            self.db,
            base_dir=self.base_dir,
            user_id=user.id,
            course_id=course.id,
            filename_original="outline.pdf",
            filename_display="Outline",
            mime_type="application/pdf",
            content=b"sample syllabus",
        )
        resource_path = course_resources.resolve_absolute_path(self.base_dir, resource)
        self.assertTrue(resource_path.is_file())

        challenge = models.EmailVerificationChallenge(
            email=user.email,
            purpose="login",
            code_hash="hash",
            expires_at="2026-04-01T00:00:00+00:00",
            created_at="2026-03-31T00:00:00+00:00",
            updated_at="2026-03-31T00:00:00+00:00",
        )
        self.db.add(challenge)
        self.db.commit()

        auth.register_rate_limit_failure(
            self.db,
            scope=auth.LOGIN_RATE_LIMIT_ACCOUNT_SCOPE,
            raw_key=user.email,
            max_attempts=5,
            window_seconds=3600,
            block_seconds=3600,
        )
        auth.register_rate_limit_failure(
            self.db,
            scope="email_send_email",
            raw_key=user.email,
            max_attempts=5,
            window_seconds=3600,
            block_seconds=3600,
        )

        with patch.object(api_auth, "BASE_DIR", self.base_dir):
            response = asyncio.run(
                api_auth.delete_user_me(
                    schemas.DeleteAccountRequest(confirmation_text=schemas.DELETE_ACCOUNT_CONFIRMATION_TEXT),
                    self._build_authenticated_delete_request(),
                    self.db,
                    user,
                )
            )

        self.assertEqual(response.status_code, 204)
        set_cookie_headers = [
            value.decode("utf-8")
            for key, value in response.raw_headers
            if key.lower() == b"set-cookie"
        ]
        self.assertTrue(any(auth.AUTH_COOKIE_NAME in header for header in set_cookie_headers))
        self.assertTrue(any(auth.AUTH_CSRF_COOKIE_NAME in header for header in set_cookie_headers))

        self.assertIsNone(crud.get_user_by_email(self.db, user_email))
        self.assertEqual(self.db.query(models.Program).count(), 0)
        self.assertEqual(self.db.query(models.Semester).count(), 0)
        self.assertEqual(self.db.query(models.Course).count(), 0)
        self.assertEqual(self.db.query(models.CourseResourceFile).count(), 0)
        self.assertEqual(self.db.query(models.Widget).count(), 0)
        self.assertEqual(self.db.query(models.Tab).count(), 0)
        self.assertEqual(self.db.query(models.TabSetting).count(), 0)
        self.assertEqual(self.db.query(models.WorkspaceTabOrderEntry).count(), 0)
        self.assertEqual(self.db.query(models.LmsIntegration).count(), 0)
        self.assertEqual(self.db.query(models.EmailVerificationChallenge).count(), 0)
        self.assertEqual(self.db.query(models.AuthRateLimit).count(), 0)
        self.assertFalse(resource_path.exists())


if __name__ == "__main__":
    unittest.main()
