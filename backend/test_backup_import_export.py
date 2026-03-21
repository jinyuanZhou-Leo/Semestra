# input:  [unittest, asyncio, temp filesystem/env setup, in-memory SQLAlchemy session, and backend backup/LMS/resource modules]
# output: [regression tests covering full backup export/import for LMS integrations, program-level courses, schedule data, resources, todo state, account settings, and gradebook point-based scores]
# pos:    [backend regression tests for the account backup pipeline across current persisted features, including gradebook point-based assessment inputs]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

import asyncio
import os
import tempfile
import unittest
from datetime import date
from pathlib import Path
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("LMS_CREDENTIALS_ENCRYPTION_KEY", "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import course_resources
import crud
import database
import gradebook
import lms_service
import main
import models
import schemas
from database import Base
from lms_crypto import decrypt_credentials
from lms_providers import LmsConnectionSummaryData, LmsProviderError


class _FakeLmsProvider:
    provider = "canvas"

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
        return LmsConnectionSummaryData(
            external_user_id="42",
            display_name="Ada Lovelace",
            login_id="ada",
            email="ada@example.com",
        )

    def get_connection_summary(self, config, credentials):
        return self.validate_connection(config, credentials)


class BackupImportExportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        os.environ["COURSE_RESOURCES_STORAGE_DIR"] = self.tempdir.name

        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = testing_session_local()

        self.original_get_lms_provider = lms_service.get_lms_provider
        self.provider = _FakeLmsProvider()
        lms_service.get_lms_provider = lambda provider: self.provider

        self.source_user = models.User(
            email="source@example.com",
            hashed_password="hashed",
            nickname="Source",
            user_setting='{"gpa_scaling_table":"{\\"90-100\\":4.0}","default_course_credit":0.75,"background_plugin_preload":false}',
        )
        self.target_user = models.User(
            email="target@example.com",
            hashed_password="hashed",
            nickname="Target",
            user_setting='{"gpa_scaling_table":"{\\"90-100\\":4.0}","default_course_credit":0.5,"background_plugin_preload":true}',
        )
        self.db.add_all([self.source_user, self.target_user])
        self.db.commit()
        self.db.refresh(self.source_user)
        self.db.refresh(self.target_user)

    def tearDown(self) -> None:
        lms_service.get_lms_provider = self.original_get_lms_provider
        self.db.close()
        self.engine.dispose()
        database.engine.dispose()
        self.tempdir.cleanup()

    def test_export_then_import_preserves_current_backup_features(self) -> None:
        integration = lms_service.create_integration(
            self.db,
            self.source_user.id,
            schemas.LmsIntegrationCreateRequest(
                provider="canvas",
                display_name="Canvas Main",
                config={"base_url": "https://canvas.example.edu"},
                credentials={"personal_access_token": "token-1"},
            ),
        )

        program = crud.create_program(
            self.db,
            schemas.ProgramCreate(
                name="Engineering",
                cgpa_scaled=3.8,
                cgpa_percentage=84.0,
                gpa_scaling_table='{"90-100":4.0}',
                subject_color_map='{"MIE":"#123abc"}',
                grad_requirement_credits=20.0,
                hide_gpa=False,
                program_timezone="America/Toronto",
                lms_integration_id=integration.id,
            ),
            self.source_user.id,
        )
        semester = crud.create_semester(
            self.db,
            schemas.SemesterCreate(
                name="Winter 2026",
                average_percentage=81.0,
                average_scaled=3.7,
                start_date=date(2026, 1, 5),
                end_date=date(2026, 4, 20),
                reading_week_start=date(2026, 2, 16),
                reading_week_end=date(2026, 2, 22),
            ),
            program.id,
        )
        semester_course = crud.create_course(
            self.db,
            schemas.CourseCreate(
                name="MIE200",
                alias="Design",
                category="MIE",
                color="#334455",
                credits=0.5,
                grade_percentage=88.0,
                grade_scaled=4.0,
                include_in_gpa=True,
                hide_gpa=False,
            ),
            program.id,
            semester.id,
        )
        program_course = crud.create_course(
            self.db,
            schemas.CourseCreate(
                name="APS500",
                alias="Capstone",
                category="APS",
                credits=1.0,
                grade_percentage=91.0,
                grade_scaled=4.0,
                include_in_gpa=True,
                hide_gpa=False,
            ),
            program.id,
            None,
        )

        crud.upsert_plugin_setting(
            self.db,
            schemas.PluginSettingCreate(plugin_id="semester-shared", settings='{"foo":"bar"}'),
            semester_id=semester.id,
        )
        crud.upsert_plugin_setting(
            self.db,
            schemas.PluginSettingCreate(plugin_id="course-shared", settings='{"alpha":1}'),
            course_id=semester_course.id,
        )
        crud.create_widget(
            self.db,
            schemas.WidgetCreate(widget_type="counter", layout_config='{"x":0,"y":0,"w":2,"h":2}', settings='{"value":3}'),
            course_id=semester_course.id,
        )
        crud.create_tab(
            self.db,
            schemas.TabCreate(tab_type="course-resources", settings='{"layout":"grid"}', order_index=1, is_removable=True, is_draggable=True),
            course_id=semester_course.id,
        )

        self.db.add(
            models.CourseEventType(
                course_id=semester_course.id,
                code="STUDIO",
                abbreviation="STD",
                track_attendance=True,
                color="#ff6600",
                icon="hammer",
                created_at="",
                updated_at="",
            )
        )
        self.db.commit()
        self.db.add(
            models.CourseSection(
                course_id=semester_course.id,
                section_id="101",
                event_type_code="STUDIO",
                title="Studio",
                instructor="Prof. Ada",
                location="Lab 2",
                day_of_week=3,
                start_time="10:00",
                end_time="12:00",
                week_pattern="ALTERNATING",
                start_week=1,
                end_week=10,
                created_at="",
                updated_at="",
            )
        )
        self.db.add(
            models.CourseEvent(
                course_id=semester_course.id,
                event_type_code="STUDIO",
                section_id="101",
                title="Studio Block",
                day_of_week=3,
                start_time="10:00",
                end_time="12:00",
                week_pattern="ALTERNATING",
                start_week=1,
                end_week=10,
                enable=True,
                skip=False,
                note="Bring materials",
                created_at="",
                updated_at="",
            )
        )
        self.db.commit()

        course_resources.create_course_resource(
            self.db,
            base_dir=main.BASE_DIR,
            user_id=self.source_user.id,
            course_id=semester_course.id,
            filename_original="notes.pdf",
            filename_display="Lecture Notes",
            mime_type="application/pdf",
            content=b"backup-bytes",
        )
        course_resources.create_external_course_resource(
            self.db,
            course_id=semester_course.id,
            external_url="https://example.com/resource",
            filename_display="Reference",
        )

        todo_section = models.TodoSection(
            semester_id=semester.id,
            name="Milestones",
            created_at="",
            updated_at="",
        )
        self.db.add(todo_section)
        self.db.commit()
        self.db.refresh(todo_section)
        self.db.add(
            models.TodoTask(
                semester_id=semester.id,
                course_id=semester_course.id,
                section_id=todo_section.id,
                origin_section_id=todo_section.id,
                title="Build prototype",
                note="Need drawings",
                due_date=date(2026, 3, 1),
                due_time="14:30",
                priority="HIGH",
                completed=False,
                created_at="",
                updated_at="",
            )
        )
        self.db.commit()

        self.db.add(
            models.CourseLmsLink(
                course_id=semester_course.id,
                program_id=program.id,
                lms_integration_id=integration.id,
                external_course_id="course-1",
                external_course_code="MIE200",
                external_name="MIE200 Canvas",
                sync_enabled=True,
                last_synced_at="2026-01-10T00:00:00Z",
                created_at="",
                updated_at="",
            )
        )
        self.db.commit()

        self.db.refresh(semester_course)
        category_id = semester_course.gradebook.categories[0].id
        self.db.add(
            models.GradebookAssessment(
                gradebook_id=semester_course.gradebook.id,
                category_id=category_id,
                title="Imported LMS Quiz",
                due_date=date(2026, 2, 10),
                weight=15.0,
                score=92.0,
                points_earned=46.0,
                points_possible=50.0,
                source_kind="lms_assignment",
                source_external_id="assignment-1",
                order_index=0,
                created_at="",
                updated_at="",
            )
        )
        self.db.commit()

        exported = asyncio.run(main.export_user_data(db=self.db, current_user=self.source_user))
        self.assertEqual(exported.version, "2.2.2")
        self.assertEqual(exported.settings.background_plugin_preload, False)
        self.assertEqual(len(exported.lms_integrations), 1)
        self.assertEqual(len(exported.programs[0].courses), 1)
        self.assertEqual(len(exported.programs[0].semesters[0].courses[0].resource_files), 2)
        self.assertEqual(len(exported.programs[0].semesters[0].todo.tasks), 1)

        result = asyncio.run(
            main.import_user_data(
                data=schemas.UserDataImport.model_validate(exported.model_dump()),
                conflict_mode="skip",
                include_settings=True,
                db=self.db,
                current_user=self.target_user,
            )
        )
        self.assertTrue(result["ok"])
        self.assertEqual(result["imported"]["lms_integrations"], 1)

        restored_user = crud.get_user(self.db, self.target_user.id)
        restored_settings = crud.get_user_setting_dict(restored_user)
        self.assertEqual(restored_user.nickname, "Source")
        self.assertEqual(restored_settings["default_course_credit"], 0.75)
        self.assertFalse(restored_settings["background_plugin_preload"])

        restored_integrations = (
            self.db.query(models.LmsIntegration)
            .filter(models.LmsIntegration.user_id == self.target_user.id)
            .all()
        )
        self.assertEqual(len(restored_integrations), 1)
        self.assertEqual(decrypt_credentials(restored_integrations[0].credentials_encrypted)["personal_access_token"], "token-1")

        restored_program = (
            self.db.query(models.Program)
            .filter(models.Program.owner_id == self.target_user.id, models.Program.name == "Engineering")
            .one()
        )
        self.assertEqual(restored_program.program_timezone, "America/Toronto")
        self.assertIsNotNone(restored_program.lms_integration_id)

        restored_semester = (
            self.db.query(models.Semester)
            .filter(models.Semester.program_id == restored_program.id, models.Semester.name == "Winter 2026")
            .one()
        )
        self.assertEqual(restored_semester.start_date, date(2026, 1, 5))
        self.assertEqual(restored_semester.reading_week_start, date(2026, 2, 16))

        restored_program_courses = crud.get_courses(self.db, restored_program.id, unassigned=True)
        self.assertEqual([course.name for course in restored_program_courses], ["APS500"])

        restored_semester_course = (
            self.db.query(models.Course)
            .filter(models.Course.program_id == restored_program.id, models.Course.semester_id == restored_semester.id)
            .one()
        )
        self.assertEqual(restored_semester_course.name, "MIE200")
        self.assertIsNotNone(restored_semester_course.lms_link)
        self.assertEqual(len(restored_semester_course.resource_files), 2)
        self.assertEqual(len(restored_semester_course.sections), 1)
        self.assertEqual(len(restored_semester_course.events), 1)
        self.assertTrue(any(event_type.code == "STUDIO" for event_type in restored_semester_course.event_types))

        restored_file = next(resource for resource in restored_semester_course.resource_files if resource.resource_kind == "file")
        restored_path = course_resources.resolve_absolute_path(main.BASE_DIR, restored_file)
        self.assertEqual(restored_path.read_bytes(), b"backup-bytes")

        restored_todo_state = (
            self.db.query(models.TodoTask)
            .filter(models.TodoTask.semester_id == restored_semester.id)
            .all()
        )
        self.assertEqual(len(restored_todo_state), 1)
        self.assertEqual(restored_todo_state[0].title, "Build prototype")

        restored_gradebook = restored_semester_course.gradebook
        self.assertIsNotNone(restored_gradebook)
        restored_assessment = restored_gradebook.assessments[0]
        self.assertEqual(restored_assessment.points_earned, 46.0)
        self.assertEqual(restored_assessment.points_possible, 50.0)
        self.assertEqual(restored_assessment.source_kind, "lms_assignment")
        self.assertEqual(restored_assessment.source_external_id, "assignment-1")


if __name__ == "__main__":
    unittest.main()
