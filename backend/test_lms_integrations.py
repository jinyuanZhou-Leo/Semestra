# input:  [unittest, in-memory SQLAlchemy setup, backend LMS service/schema/crypto modules, and fake provider adapters]
# output: [unit tests covering multi-integration LMS storage, Program/Course LMS link rules, provider-backed imports, read-only assignment/calendar contracts, and program-level course stat/reassignment safeguards]
# pos:    [backend regression tests for LMS orchestration plus program/course behaviors that interact with provider setup and semester assignment]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import json
import os
import unittest
from datetime import date
from pathlib import Path
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import crud
import lms_service
import models
import schemas
from database import Base
from lms_crypto import decrypt_credentials, encrypt_credentials
from lms_providers import (
    LmsAssignmentSummaryData,
    LmsCalendarEventSummaryData,
    LmsConnectionSummaryData,
    LmsCoursePageData,
    LmsCourseSummaryData,
    LmsProviderError,
)


class _FakeLmsProvider:
    provider = "canvas"

    def __init__(self) -> None:
        self.validation_fail = False
        self.last_list_courses_args = None

    def normalize_integration_config(self, value):
        if not isinstance(value, dict):
            raise LmsProviderError("LMS_CONFIG_INVALID", "config must be a JSON object.")
        base_url = str(value.get("base_url") or "").strip()
        if not base_url:
            raise LmsProviderError("LMS_CONFIG_INVALID", "base_url is required.")
        return {"base_url": base_url.rstrip("/")}

    def normalize_integration_credentials(self, value):
        if not isinstance(value, dict):
            raise LmsProviderError("LMS_CREDENTIALS_INVALID", "credentials must be a JSON object.")
        token = str(value.get("personal_access_token") or "").strip()
        if not token:
            raise LmsProviderError("LMS_CREDENTIALS_INVALID", "personal_access_token is required.")
        return {"personal_access_token": token}

    def mask_credentials(self, credentials):
        token = str(credentials.get("personal_access_token") or "").strip()
        return f"{token[:4]}{'*' * max(4, len(token) - 4)}" if token else None

    def validate_connection(self, config, credentials):
        if self.validation_fail:
            raise LmsProviderError("LMS_CONNECTION_AUTH_FAILED", "Canvas rejected the personal access token.")
        return LmsConnectionSummaryData(
            external_user_id="42",
            display_name="Ada Lovelace",
            login_id="ada",
            email="ada@example.com",
        )

    def get_connection_summary(self, config, credentials):
        return self.validate_connection(config, credentials)

    def list_courses(self, config, credentials, *, page, page_size, workflow_state, enrollment_state):
        self.last_list_courses_args = {
            "page": page,
            "page_size": page_size,
            "workflow_state": workflow_state,
            "enrollment_state": enrollment_state,
        }
        courses = [
            LmsCourseSummaryData(
                external_id="course-1",
                name="Algorithms",
                course_code="CSC373",
                workflow_state="available",
                start_at="2026-01-05T00:00:00Z",
                end_at="2026-04-20T00:00:00Z",
            ),
            LmsCourseSummaryData(
                external_id="course-2",
                name="Databases",
                course_code="CSC343",
                workflow_state="available",
                start_at="2026-01-05T00:00:00Z",
                end_at="2026-04-20T00:00:00Z",
            ),
        ]
        if workflow_state:
            courses = [course for course in courses if course.workflow_state == workflow_state]
        return LmsCoursePageData(
            items=courses[:page_size],
            page=page,
            page_size=page_size,
            has_more=False,
            next_page=None,
        )

    def get_course(self, config, credentials, external_course_id):
        return LmsCourseSummaryData(
            external_id=external_course_id,
            name=f"Course {external_course_id}",
            course_code=f"CSC{external_course_id[-1]}00",
            workflow_state="available",
            start_at=None,
            end_at=None,
        )

    def list_assignments(self, config, credentials, external_course_id):
        return [
            LmsAssignmentSummaryData(
                external_id=f"{external_course_id}-assignment-1",
                title="Problem Set",
                description=None,
                due_at="2026-02-01T12:00:00Z",
                due_date="2026-02-01",
                unlock_at=None,
                lock_at=None,
                html_url="https://canvas.example.edu/assignments/1",
                published=True,
                submission_types=["online_upload"],
            ),
        ]

    def list_calendar_events(self, config, credentials, *, context_codes, start_at, end_at):
        del start_at, end_at
        return [
            LmsCalendarEventSummaryData(
                external_id=f"{context_code}-event",
                external_course_id=context_code.replace("course_", ""),
                title="Midterm",
                description=None,
                location="Room 101",
                start_at="2026-02-10T14:00:00Z",
                end_at="2026-02-10T16:00:00Z",
                all_day=False,
                html_url="https://canvas.example.edu/calendar",
                event_type_code="CALENDAR",
            )
            for context_code in context_codes
        ]


class LmsIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.previous_key = os.environ.get("LMS_CREDENTIALS_ENCRYPTION_KEY")
        os.environ["LMS_CREDENTIALS_ENCRYPTION_KEY"] = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="

        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = testing_session_local()

        user = models.User(email="lms@example.com", hashed_password="hashed", user_setting="{}")
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        self.user = user

        self.provider = _FakeLmsProvider()
        self.original_get_lms_provider = lms_service.get_lms_provider
        lms_service.get_lms_provider = lambda provider: self.provider

        self.program = crud.create_program(
            self.db,
            schemas.ProgramCreate(name="Computer Science", lms_integration_id=None),
            self.user.id,
        )
        self.semester = crud.create_semester(
            self.db,
            schemas.SemesterCreate(
                name="Winter 2026",
                start_date=date(2026, 1, 5),
                end_date=date(2026, 4, 20),
            ),
            self.program.id,
        )

    def tearDown(self) -> None:
        lms_service.get_lms_provider = self.original_get_lms_provider
        self.db.close()
        self.engine.dispose()
        if self.previous_key is None:
            os.environ.pop("LMS_CREDENTIALS_ENCRYPTION_KEY", None)
        else:
            os.environ["LMS_CREDENTIALS_ENCRYPTION_KEY"] = self.previous_key

    def _build_create_payload(self, token: str = "token-1", display_name: str = "Canvas Main") -> schemas.LmsIntegrationCreateRequest:
        return schemas.LmsIntegrationCreateRequest(
            provider="canvas",
            display_name=display_name,
            config={"base_url": "https://canvas.example.edu"},
            credentials={"personal_access_token": token},
        )

    def test_encrypt_credentials_produces_versioned_metadata(self) -> None:
        encrypted = encrypt_credentials({"personal_access_token": "secret"})
        envelope = json.loads(encrypted)

        self.assertEqual(envelope["version"], "v1")
        self.assertEqual(envelope["algorithm"], "AES256_GCM")
        self.assertIn("nonce", envelope)
        self.assertIn("ciphertext", envelope)
        self.assertIn("tag", envelope)
        self.assertEqual(decrypt_credentials(encrypted)["personal_access_token"], "secret")

    def test_create_integration_persists_connected_record_without_plaintext_secret(self) -> None:
        response = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())

        self.assertEqual(response.status, "connected")
        self.assertEqual(response.summary.external_user_id, "42")

        record = self.db.query(models.LmsIntegration).filter(models.LmsIntegration.user_id == self.user.id).one()
        self.assertEqual(record.display_name, "Canvas Main")
        self.assertNotIn("token-1", record.credentials_encrypted)
        self.assertEqual(decrypt_credentials(record.credentials_encrypted)["personal_access_token"], "token-1")

    def test_list_courses_supports_multiple_integrations(self) -> None:
        first = lms_service.create_integration(self.db, self.user.id, self._build_create_payload(display_name="Canvas A"))
        second = lms_service.create_integration(self.db, self.user.id, self._build_create_payload(token="token-2", display_name="Canvas B"))

        response = lms_service.list_courses_for_integration(
            self.db,
            self.user.id,
            second.id,
            page=1,
            page_size=20,
            workflow_state="available",
            enrollment_state="active",
        )

        self.assertEqual(first.provider, second.provider)
        self.assertEqual(response.integration_id, second.id)
        self.assertEqual(len(response.items), 2)
        self.assertEqual(
            self.provider.last_list_courses_args,
            {
                "page": 1,
                "page_size": 20,
                "workflow_state": "available",
                "enrollment_state": "active",
            },
        )

    def test_update_integration_allows_display_name_only(self) -> None:
        created = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())

        updated = lms_service.update_integration(
            self.db,
            self.user.id,
            created.id,
            schemas.LmsIntegrationUpdateRequest(display_name="Canvas Renamed"),
        )

        self.assertEqual(updated.display_name, "Canvas Renamed")
        record = self.db.query(models.LmsIntegration).filter(models.LmsIntegration.id == created.id).one()
        self.assertEqual(record.display_name, "Canvas Renamed")
        self.assertEqual(decrypt_credentials(record.credentials_encrypted)["personal_access_token"], "token-1")

    def test_update_integration_allows_config_only_with_stored_credentials(self) -> None:
        created = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())

        updated = lms_service.update_integration(
            self.db,
            self.user.id,
            created.id,
            schemas.LmsIntegrationUpdateRequest(config={"base_url": "https://canvas.changed.example.edu"}),
        )

        self.assertEqual(updated.config["base_url"], "https://canvas.changed.example.edu")
        record = self.db.query(models.LmsIntegration).filter(models.LmsIntegration.id == created.id).one()
        self.assertEqual(decrypt_credentials(record.credentials_encrypted)["personal_access_token"], "token-1")

    def test_program_cannot_switch_integration_after_lms_dependencies_exist(self) -> None:
        first = lms_service.create_integration(self.db, self.user.id, self._build_create_payload(display_name="Canvas A"))
        second = lms_service.create_integration(self.db, self.user.id, self._build_create_payload(token="token-2", display_name="Canvas B"))
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=first.id),
            self.user.id,
        )
        import_response = lms_service.import_program_courses(
            self.db,
            self.user.id,
            self.program.id,
            schemas.LmsCourseImportRequest(external_course_ids=["course-1"]),
        )

        self.assertEqual(import_response.results[0].status, "created")
        with self.assertRaises(crud.ProgramLmsDependencyError) as context:
            crud.update_program(
                self.db,
                self.program.id,
                schemas.ProgramUpdate(lms_integration_id=second.id),
                self.user.id,
            )

        self.assertEqual(str(context.exception), "PROGRAM_LMS_DEPENDENCIES_EXIST")

    def test_existing_course_can_link_to_program_integration(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )
        course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="Algorithms", credits=0.5, category="CSC"),
            self.program.id,
            self.semester.id,
        )

        link = lms_service.upsert_course_link(
            self.db,
            self.user.id,
            course.id,
            schemas.LmsCourseLinkUpdateRequest(external_course_id="course-1"),
        )

        self.assertEqual(link.external_course_id, "course-1")
        self.assertEqual(link.integration_display_name, "Canvas Main")

    def test_same_external_course_cannot_link_twice_in_program(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )
        first_course = crud.create_course(self.db, schemas.CourseCreate(name="Algorithms", credits=0.5), self.program.id, self.semester.id)
        second_course = crud.create_course(self.db, schemas.CourseCreate(name="Databases", credits=0.5), self.program.id, self.semester.id)
        lms_service.upsert_course_link(
            self.db,
            self.user.id,
            first_course.id,
            schemas.LmsCourseLinkUpdateRequest(external_course_id="course-1"),
        )

        with self.assertRaises(lms_service.LmsServiceError) as context:
            lms_service.upsert_course_link(
                self.db,
                self.user.id,
                second_course.id,
                schemas.LmsCourseLinkUpdateRequest(external_course_id="course-1"),
            )

        self.assertEqual(context.exception.code, "COURSE_LMS_LINK_CONFLICT")

    def test_import_program_courses_creates_local_courses_and_links(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )

        response = lms_service.import_program_courses(
            self.db,
            self.user.id,
            self.program.id,
            schemas.LmsCourseImportRequest(
                external_course_ids=["course-1", "course-2"],
                semester_id=self.semester.id,
            ),
        )

        self.assertEqual([item.status for item in response.results], ["created", "created"])
        linked_courses = self.db.query(models.CourseLmsLink).filter(models.CourseLmsLink.program_id == self.program.id).all()
        self.assertEqual(len(linked_courses), 2)

    def test_read_only_assignment_and_calendar_reads_use_local_course_context(self) -> None:
        integration = lms_service.create_integration(self.db, self.user.id, self._build_create_payload())
        crud.update_program(
            self.db,
            self.program.id,
            schemas.ProgramUpdate(lms_integration_id=integration.id),
            self.user.id,
        )
        response = lms_service.import_program_courses(
            self.db,
            self.user.id,
            self.program.id,
            schemas.LmsCourseImportRequest(
                external_course_ids=["course-1"],
                semester_id=self.semester.id,
            ),
        )
        course = response.results[0].course
        assert course is not None

        assignments = lms_service.list_course_assignments(self.db, self.user.id, course.id)
        semester_calendar = lms_service.list_semester_calendar_events(self.db, self.user.id, self.semester.id)

        self.assertEqual(assignments.items[0].course_id, course.id)
        self.assertEqual(assignments.items[0].course_name, course.name)
        self.assertEqual(assignments.items[0].course_display_code, "CSC100")
        self.assertEqual(len(semester_calendar.items), 2)
        self.assertTrue(all(item.course_id == course.id for item in semester_calendar.items))
        self.assertTrue(all(item.course_name == course.name for item in semester_calendar.items))
        self.assertTrue(all(item.course_display_code == "CSC100" for item in semester_calendar.items))
        self.assertEqual({item.event_type_code for item in semester_calendar.items}, {"CALENDAR", "ASSIGNMENT"})

    def test_program_level_course_recomputes_grade_scaled_without_semester(self) -> None:
        course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="Program Level", credits=0.5, grade_percentage=85),
            self.program.id,
            None,
        )

        self.assertIsNone(course.semester_id)
        self.assertEqual(course.grade_scaled, 4.0)

        updated = crud.update_course(
            self.db,
            course.id,
            schemas.CourseUpdate(grade_percentage=80),
        )

        self.assertEqual(updated.grade_scaled, 3.7)

    def test_removing_course_from_semester_recomputes_previous_semester_stats(self) -> None:
        course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="Assigned", credits=0.5, grade_percentage=80),
            self.program.id,
            self.semester.id,
        )
        self.db.refresh(self.semester)
        self.assertEqual(self.semester.average_percentage, 80.0)
        self.assertEqual(self.semester.average_scaled, 3.7)

        updated = crud.update_course(
            self.db,
            course.id,
            schemas.CourseUpdate(semester_id=None),
        )

        self.assertIsNone(updated.semester_id)
        self.assertEqual(updated.grade_scaled, 3.7)
        self.db.refresh(self.semester)
        self.assertEqual(self.semester.average_percentage, 0.0)
        self.assertEqual(self.semester.average_scaled, 0.0)

    def test_course_cannot_move_to_semester_in_another_program(self) -> None:
        other_program = crud.create_program(
            self.db,
            schemas.ProgramCreate(name="Other Program", lms_integration_id=None),
            self.user.id,
        )
        other_semester = crud.create_semester(
            self.db,
            schemas.SemesterCreate(name="Other Semester"),
            other_program.id,
        )
        course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="Algorithms", credits=0.5, category="CSC"),
            self.program.id,
            self.semester.id,
        )

        with self.assertRaises(crud.CourseSemesterAssignmentError) as context:
            crud.update_course(
                self.db,
                course.id,
                schemas.CourseUpdate(semester_id=other_semester.id),
            )

        self.assertEqual(str(context.exception), "SEMESTER_PROGRAM_MISMATCH")


if __name__ == "__main__":
    unittest.main()
