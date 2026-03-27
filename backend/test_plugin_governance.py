# input:  [unittest, in-memory SQLAlchemy setup, backend CRUD helpers, schemas, and plugin governance contract]
# output: [backend regression tests covering Program/Semester plugin governance, resolved-config rules, and draft review lifecycle enforcement]
# pos:    [backend unit tests for Program/Semester plugin governance and Semester draft flows without requiring a running Semestra server]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from datetime import date
from pathlib import Path
import sys
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import crud
from database import Base
import models
import schemas


class PluginGovernanceDraftTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        self.testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.testing_session_local()
        self.user = models.User(email="plugin-governance@example.com", hashed_password="hashed", user_setting="{}")
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _create_program(self) -> models.Program:
        return crud.create_program(
            self.db,
            schemas.ProgramCreate(name="Engineering"),
            user_id=self.user.id,
        )

    def test_finalize_blocks_when_draft_review_has_errors(self) -> None:
        program = self._create_program()
        draft = crud.create_semester_draft(
            self.db,
            program.id,
            schemas.SemesterDraftCreateRequest(
                name="Winter 2026",
                start_date=date(2026, 1, 5),
                end_date=date(2026, 4, 10),
                creation_step="basics",
            ),
        )

        updated = crud.update_semester_draft(
            self.db,
            draft["id"],
            schemas.SemesterDraftUpdateRequest(
                reading_week_start=date(2026, 2, 16),
                reading_week_end=date(2026, 2, 20),
                creation_step="review",
            ),
        )

        self.assertFalse(updated["review_ready"])
        self.assertIn("INVALID_READING_WEEK_SPAN", {error["code"] for error in updated["review_errors"]})

        with self.assertRaises(crud.PluginGovernanceError) as context:
            crud.finalize_semester_draft(self.db, draft["id"])

        self.assertEqual(context.exception.code, "SEMESTER_DRAFT_REVIEW_FAILED")

    def test_review_serialization_includes_plugin_setup_summary(self) -> None:
        program = self._create_program()
        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "builtin-event-core",
            schemas.ProgramPluginInstallationUpsertRequest(),
        )
        draft = crud.create_semester_draft(
            self.db,
            program.id,
            schemas.SemesterDraftCreateRequest(
                name="Winter 2026",
                start_date=date(2026, 1, 5),
                end_date=date(2026, 4, 10),
                creation_step="plugin-setup",
            ),
        )

        activation = crud.upsert_semester_plugin_activation(
            self.db,
            draft["id"],
            "builtin-event-core",
            schemas.SemesterPluginActivationUpsertRequest(
                semester_overrides={"calendarDefaultView": "week"},
                setup_state={"calendarDefaultView": "week"},
            ),
        )

        self.assertEqual(activation["resolved_settings"]["calendarDefaultView"], "week")

        draft_payload = crud._serialize_semester_draft(
            self.db.query(models.Semester).filter(models.Semester.id == draft["id"]).first()
        )
        event_core_activation = next(
            item for item in draft_payload["plugin_activations"] if item["plugin_id"] == "builtin-event-core"
        )

        self.assertTrue(draft_payload["review_ready"])
        self.assertEqual(event_core_activation["setup_summary"][0]["items"][0]["value"], "week")

    def test_program_only_field_is_rejected_from_semester_overrides(self) -> None:
        program = self._create_program()
        draft = crud.create_semester_draft(
            self.db,
            program.id,
            schemas.SemesterDraftCreateRequest(
                name="Winter 2026",
                start_date=date(2026, 1, 5),
                end_date=date(2026, 4, 10),
                creation_step="plugins",
            ),
        )

        with self.assertRaises(crud.PluginGovernanceError) as context:
            crud.upsert_semester_plugin_activation(
                self.db,
                draft["id"],
                "course-list",
                schemas.SemesterPluginActivationUpsertRequest(
                    semester_overrides={"allowCourseCreation": False},
                ),
            )

        self.assertEqual(context.exception.code, "SEMESTER_PLUGIN_OVERRIDES_INVALID")

    def test_program_installation_serializes_resolved_settings_and_availability(self) -> None:
        program = self._create_program()

        installation = crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "builtin-event-core",
            schemas.ProgramPluginInstallationUpsertRequest(
                program_settings={"syncLmsCalendar": False},
            ),
        )
        canvas_installation = crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "builtin-canvas-integration",
            schemas.ProgramPluginInstallationUpsertRequest(),
        )

        self.assertEqual(installation["resolved_program_settings"]["syncLmsCalendar"], False)
        self.assertEqual(installation["resolved_program_settings"]["calendarDefaultView"], "month")
        self.assertEqual(installation["author"], "Jinyuan")
        self.assertTrue(installation["is_enabled"])
        self.assertTrue(installation["available"])
        self.assertFalse(canvas_installation["available"])
        self.assertEqual(canvas_installation["availability_reason"], "Program LMS integration is required.")

    def test_disabling_semester_plugin_preserves_activation_data(self) -> None:
        program = self._create_program()
        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "builtin-event-core",
            schemas.ProgramPluginInstallationUpsertRequest(is_enabled=True),
        )
        draft = crud.create_semester_draft(
            self.db,
            program.id,
            schemas.SemesterDraftCreateRequest(
                name="Winter 2026",
                start_date=date(2026, 1, 5),
                end_date=date(2026, 4, 10),
                creation_step="plugin-setup",
            ),
        )

        activation = crud.upsert_semester_plugin_activation(
            self.db,
            draft["id"],
            "builtin-event-core",
            schemas.SemesterPluginActivationUpsertRequest(
                semester_overrides={"calendarDefaultView": "week"},
                setup_state={"calendarDefaultView": "week"},
                is_enabled=True,
            ),
        )
        disabled = crud.upsert_semester_plugin_activation(
            self.db,
            draft["id"],
            "builtin-event-core",
            schemas.SemesterPluginActivationUpsertRequest(is_enabled=False),
        )

        self.assertFalse(disabled["is_enabled"])
        self.assertEqual(disabled["setup_state"]["calendarDefaultView"], "week")
        self.assertEqual(disabled["semester_overrides"]["calendarDefaultView"], "week")

        stored_activation = self.db.query(models.SemesterPluginActivation).filter(
            models.SemesterPluginActivation.id == activation["id"]
        ).first()
        self.assertIsNotNone(stored_activation)
        self.assertFalse(bool(stored_activation.is_enabled))

    def test_locked_semester_plugins_serialize_and_refuse_delete(self) -> None:
        program = self._create_program()
        semester = crud.create_semester(
            self.db,
            schemas.SemesterCreate(
                name="Winter 2026",
                start_date=date(2026, 1, 5),
                end_date=date(2026, 4, 10),
            ),
            program.id,
        )

        activations = crud.get_semester_plugin_activations(self.db, semester.id)
        settings_activation = next(
            item for item in activations if item["plugin_id"] == "builtin-settings"
        )

        self.assertTrue(settings_activation["locked"])

        with self.assertRaises(crud.PluginGovernanceError) as context:
            crud.delete_semester_plugin_activation(self.db, semester.id, "builtin-settings")

        self.assertEqual(context.exception.code, "PLUGIN_LOCKED")

    def test_program_installed_non_default_plugins_do_not_auto_activate_for_semester_or_course(self) -> None:
        program = self._create_program()
        semester = crud.create_semester(
            self.db,
            schemas.SemesterCreate(
                name="Winter 2026",
                start_date=date(2026, 1, 5),
                end_date=date(2026, 4, 10),
            ),
            program.id,
        )
        course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="APS105", credits=0.5),
            program.id,
            semester_id=semester.id,
        )

        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "course-resources",
            schemas.ProgramPluginInstallationUpsertRequest(is_enabled=True),
        )

        semester_activations = crud.get_semester_plugin_activations(self.db, semester.id)
        course_activations = crud.get_course_inherited_plugin_activations(self.db, course.id)

        self.assertNotIn("course-resources", {item["plugin_id"] for item in semester_activations})
        self.assertNotIn("course-resources", {item["plugin_id"] for item in course_activations})

    def test_draft_resume_and_discard_remove_draft_children(self) -> None:
        program = self._create_program()
        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "builtin-event-core",
            schemas.ProgramPluginInstallationUpsertRequest(),
        )
        draft = crud.create_semester_draft(
            self.db,
            program.id,
            schemas.SemesterDraftCreateRequest(
                name="Winter 2026",
                start_date=date(2026, 1, 5),
                end_date=date(2026, 4, 10),
                creation_step="courses",
            ),
        )

        resumed = crud.get_current_semester_draft(self.db, program.id)
        self.assertIsNotNone(resumed)
        self.assertEqual(resumed.id, draft["id"])

        created_course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="APS105", alias="Calc", credits=0.5),
            program.id,
            semester_id=draft["id"],
        )
        crud.upsert_semester_plugin_activation(
            self.db,
            draft["id"],
            "builtin-event-core",
            schemas.SemesterPluginActivationUpsertRequest(
                semester_overrides={"calendarDefaultView": "week"},
                setup_state={"calendarDefaultView": "week"},
            ),
        )

        discarded = crud.discard_semester_draft(self.db, draft["id"])
        self.assertIsNotNone(discarded)
        self.assertIsNone(crud.get_current_semester_draft(self.db, program.id))
        self.assertIsNone(self.db.query(models.Semester).filter(models.Semester.id == draft["id"]).first())
        self.assertIsNone(self.db.query(models.Course).filter(models.Course.id == created_course.id).first())
        self.assertEqual(
            self.db.query(models.SemesterPluginActivation).filter(models.SemesterPluginActivation.semester_id == draft["id"]).count(),
            0,
        )


if __name__ == "__main__":
    unittest.main()
