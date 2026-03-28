# input:  [unittest, in-memory SQLAlchemy setup, backend CRUD helpers, schemas, and plugin governance contract]
# output: [backend regression tests covering Program/Semester plugin governance, Program-enabled plugin visibility across Semester settings, Program-disabled plugin hiding, manifest-backed plugin-system setup flows, legacy homepage-tab normalization, resolved-config rules, and draft review lifecycle enforcement plus the single-draft database invariant]
# pos:    [backend unit tests for Program/Semester plugin governance, Program-enabled or Program-disabled Semester visibility rules, plugin-system setup contracts, legacy Semester tab normalization, and draft flows plus draft-uniqueness enforcement without requiring a running Semestra server]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from datetime import date
from pathlib import Path
import sys
import unittest

from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import crud
from database import Base
import models
import plugin_governance
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

    def test_draft_creation_starts_without_homepage_shell_tabs(self) -> None:
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

        stored_draft = self.db.query(models.Semester).filter(models.Semester.id == draft["id"]).first()
        self.assertIsNotNone(stored_draft)
        self.assertEqual(stored_draft.tabs, [])

    def test_database_enforces_one_draft_per_program(self) -> None:
        program = self._create_program()
        self.db.add(
            models.Semester(
                name="Winter 2026",
                program_id=program.id,
                start_date=date(2026, 1, 5),
                end_date=date(2026, 4, 10),
                lifecycle_state="draft",
                creation_step="basics",
                draft_updated_at="2026-03-27T10:00:00Z",
                review_ready=False,
            )
        )
        self.db.commit()

        self.db.add(
            models.Semester(
                name="Fall 2026",
                program_id=program.id,
                start_date=date(2026, 9, 8),
                end_date=date(2026, 12, 18),
                lifecycle_state="draft",
                creation_step="basics",
                draft_updated_at="2026-03-27T10:01:00Z",
                review_ready=False,
            )
        )
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()

    def test_invalid_creation_step_is_rejected_by_schema(self) -> None:
        with self.assertRaises(Exception):
            schemas.SemesterDraftUpdateRequest(creation_step="not-a-real-step")

    def test_semester_tab_normalizer_canonicalizes_legacy_dashboard_and_settings_tabs(self) -> None:
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

        self.db.add(
            models.Tab(
                semester_id=semester.id,
                tab_type="dashboard",
                settings='{"legacy": true}',
                order_index=-2,
                is_removable=False,
                is_draggable=False,
            )
        )
        self.db.add(
            models.Tab(
                semester_id=semester.id,
                tab_type="settings",
                settings="{}",
                order_index=99,
                is_removable=False,
                is_draggable=False,
            )
        )
        self.db.commit()
        self.db.refresh(semester)

        crud.ensure_semester_tabs_normalized(self.db, semester)

        repaired_semester = self.db.query(models.Semester).filter(models.Semester.id == semester.id).first()
        self.assertIsNotNone(repaired_semester)
        self.assertEqual(
            sorted(tab.tab_type for tab in repaired_semester.tabs),
            ["builtin-dashboard", "builtin-setting"],
        )
        dashboard_tab = next(tab for tab in repaired_semester.tabs if tab.tab_type == "builtin-dashboard")
        self.assertEqual(dashboard_tab.settings, '{"legacy": true}')
        self.assertEqual(int(dashboard_tab.order_index or 0), -2)

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
        crud.upsert_semester_plugin_activation(
            self.db,
            draft["id"],
            "builtin-event-core",
            schemas.SemesterPluginActivationUpsertRequest(is_enabled=True),
        )

        activation = crud.update_semester_plugin_system_setup(
            self.db,
            draft["id"],
            "builtin-event-core",
            schemas.PluginSystemSemesterSetupUpdateRequest(
                values={"calendarDefaultView": "week"},
            ),
        )

        self.assertEqual(activation["setup_values"]["calendarDefaultView"], "week")

        draft_payload = crud._serialize_semester_draft(
            self.db.query(models.Semester).filter(models.Semester.id == draft["id"]).first()
        )
        event_core_activation = next(
            item for item in draft_payload["plugin_activations"] if item["plugin_id"] == "builtin-event-core"
        )

        self.assertTrue(draft_payload["review_ready"])
        self.assertEqual(event_core_activation["setup_summary"][0]["items"][0]["value"], "Week")

    def test_program_only_field_is_rejected_from_semester_overrides(self) -> None:
        with self.assertRaises(plugin_governance.PluginGovernanceValidationError) as context:
            plugin_governance.normalize_semester_overrides("course-list", {"allowCourseCreation": False})

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
        crud.upsert_semester_plugin_activation(
            self.db,
            draft["id"],
            "builtin-event-core",
            schemas.SemesterPluginActivationUpsertRequest(is_enabled=True),
        )

        activation = crud.update_semester_plugin_system_setup(
            self.db,
            draft["id"],
            "builtin-event-core",
            schemas.PluginSystemSemesterSetupUpdateRequest(
                values={"calendarDefaultView": "week"},
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
            models.SemesterPluginActivation.id == disabled["id"]
        ).first()
        self.assertIsNotNone(stored_activation)
        self.assertFalse(bool(stored_activation.is_enabled))

    def test_bulk_enabling_semester_plugins_updates_draft_in_one_payload(self) -> None:
        program = self._create_program()
        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "builtin-event-core",
            schemas.ProgramPluginInstallationUpsertRequest(is_enabled=True),
        )
        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "course-list",
            schemas.ProgramPluginInstallationUpsertRequest(is_enabled=True),
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

        updated_draft = crud.bulk_update_semester_plugin_activations(
            self.db,
            draft["id"],
            schemas.SemesterPluginActivationBulkUpdateRequest(
                plugin_ids=["builtin-event-core", "course-list", "builtin-event-core"],
                is_enabled=True,
            ),
        )

        self.assertEqual(updated_draft["creation_step"], "plugins")
        activation_by_plugin_id = {
            activation["plugin_id"]: activation
            for activation in updated_draft["plugin_activations"]
        }
        self.assertTrue(activation_by_plugin_id["builtin-event-core"]["is_enabled"])
        self.assertTrue(activation_by_plugin_id["course-list"]["is_enabled"])

    def test_bulk_enabling_unavailable_plugin_is_rejected(self) -> None:
        program = self._create_program()
        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "builtin-canvas-integration",
            schemas.ProgramPluginInstallationUpsertRequest(is_enabled=True),
        )
        draft = crud.create_semester_draft(
            self.db,
            program.id,
            schemas.SemesterDraftCreateRequest(
                name="Winter 2026",
                start_date=date(2026, 1, 5),
                end_date=date(2026, 4, 10),
            ),
        )

        with self.assertRaises(crud.PluginGovernanceError) as context:
            crud.bulk_update_semester_plugin_activations(
                self.db,
                draft["id"],
                schemas.SemesterPluginActivationBulkUpdateRequest(
                    plugin_ids=["builtin-canvas-integration"],
                    is_enabled=True,
                ),
            )

        self.assertEqual(context.exception.code, "PLUGIN_NOT_AVAILABLE")

    def test_locked_semester_plugins_serialize_and_refuse_disable_or_delete(self) -> None:
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
            item for item in activations if item["plugin_id"] == "builtin-setting"
        )

        self.assertTrue(settings_activation["locked"])

        with self.assertRaises(crud.PluginGovernanceError) as context:
            crud.upsert_semester_plugin_activation(
                self.db,
                semester.id,
                "builtin-setting",
                schemas.SemesterPluginActivationUpsertRequest(is_enabled=False),
            )

        self.assertEqual(context.exception.code, "PLUGIN_LOCKED")

        with self.assertRaises(crud.PluginGovernanceError) as context:
            crud.bulk_update_semester_plugin_activations(
                self.db,
                semester.id,
                schemas.SemesterPluginActivationBulkUpdateRequest(
                    plugin_ids=["builtin-setting"],
                    is_enabled=False,
                ),
            )

        self.assertEqual(context.exception.code, "PLUGIN_LOCKED")

        with self.assertRaises(crud.PluginGovernanceError) as context:
            crud.delete_semester_plugin_activation(self.db, semester.id, "builtin-setting")

        self.assertEqual(context.exception.code, "PLUGIN_LOCKED")

    def test_legacy_builtin_settings_installation_is_normalized(self) -> None:
        program = self._create_program()
        legacy_installation = models.ProgramPluginInstallation(
            program_id=program.id,
            plugin_id="builtin-settings",
            version="workspace",
            is_enabled=True,
            auth_state="not-required",
            auth_message=None,
            program_settings="{}",
            created_at="2026-03-28T00:00:00Z",
            updated_at="2026-03-28T00:00:00Z",
        )
        self.db.add(legacy_installation)
        self.db.commit()

        installations = crud.get_program_plugin_installations(self.db, program.id)
        settings_installation = next(
            item for item in installations if item["plugin_id"] == "builtin-setting"
        )

        self.assertEqual(settings_installation["display_name"], "Settings")
        stored_installations = self.db.query(models.ProgramPluginInstallation).filter(
            models.ProgramPluginInstallation.program_id == program.id,
            models.ProgramPluginInstallation.plugin_id == "builtin-setting",
        ).all()
        self.assertEqual(len(stored_installations), 1)

    def test_program_enabled_plugins_appear_in_semester_settings_before_activation(self) -> None:
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

        course_resources_activation = next(
            item for item in semester_activations if item["plugin_id"] == "course-resources"
        )

        self.assertIsNone(course_resources_activation["id"])
        self.assertFalse(course_resources_activation["is_enabled"])
        self.assertEqual(course_resources_activation["availability_reason"], "Disabled for this Semester.")
        self.assertNotIn("course-resources", {item["plugin_id"] for item in course_activations})

    def test_assigned_course_inherits_enabled_semester_plugin_runtime(self) -> None:
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
            schemas.CourseCreate(name="APS106", credits=0.5),
            program.id,
            semester_id=semester.id,
        )

        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "course-resources",
            schemas.ProgramPluginInstallationUpsertRequest(is_enabled=True),
        )
        crud.upsert_semester_plugin_activation(
            self.db,
            semester.id,
            "course-resources",
            schemas.SemesterPluginActivationUpsertRequest(is_enabled=True),
        )

        activations = crud.get_course_plugin_activations(self.db, course.id)
        resources_activation = next(
            item for item in activations if item["plugin_id"] == "course-resources"
        )

        self.assertTrue(resources_activation["is_enabled"])
        self.assertTrue(resources_activation["available"])
        self.assertEqual(resources_activation["source"], "semester")
        self.assertEqual(
            resources_activation["capabilities"]["available_tab_types"],
            ["course-resources-tab"],
        )
        self.assertIsInstance(resources_activation["resolved_settings"], dict)

    def test_unassigned_course_plugins_default_to_off_rows_and_can_enable(self) -> None:
        program = self._create_program()
        course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="APS500", credits=1.0),
            program.id,
            semester_id=None,
        )
        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "course-resources",
            schemas.ProgramPluginInstallationUpsertRequest(is_enabled=True),
        )

        activations = crud.get_course_plugin_activations(self.db, course.id)
        resources_activation = next(
            item for item in activations if item["plugin_id"] == "course-resources"
        )

        self.assertIsNone(resources_activation["id"])
        self.assertFalse(resources_activation["is_enabled"])
        self.assertFalse(resources_activation["available"])
        self.assertEqual(resources_activation["availability_reason"], "Disabled for this Course.")

        enabled = crud.upsert_course_plugin_activation(
            self.db,
            course.id,
            "course-resources",
            schemas.CoursePluginActivationUpsertRequest(is_enabled=True),
        )

        self.assertTrue(enabled["is_enabled"])
        self.assertTrue(enabled["available"])
        self.assertEqual(enabled["source"], "course")
        self.db.refresh(course)
        self.assertEqual(
            [tab.tab_type for tab in course.tabs],
            enabled["capabilities"]["available_tab_types"],
        )

    def test_unassigned_course_filters_plugins_without_unassigned_support(self) -> None:
        program = self._create_program()
        course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="APS500", credits=1.0),
            program.id,
            semester_id=None,
        )
        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "builtin-event-core",
            schemas.ProgramPluginInstallationUpsertRequest(is_enabled=True),
        )

        self.assertEqual(crud.get_course_plugin_activations(self.db, course.id), [])

    def test_assigned_course_rejects_course_level_plugin_governance(self) -> None:
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

        with self.assertRaises(crud.PluginGovernanceError) as context:
            crud.upsert_course_plugin_activation(
                self.db,
                course.id,
                "course-resources",
                schemas.CoursePluginActivationUpsertRequest(is_enabled=True),
            )

        self.assertEqual(context.exception.code, "COURSE_NOT_UNASSIGNED")

        with self.assertRaises(crud.PluginGovernanceError) as context:
            crud.bulk_update_course_plugin_activations(
                self.db,
                course.id,
                schemas.CoursePluginActivationBulkUpdateRequest(
                    plugin_ids=["course-resources"],
                    is_enabled=True,
                ),
            )

        self.assertEqual(context.exception.code, "COURSE_NOT_UNASSIGNED")

    def test_course_plugin_activation_is_ignored_in_semester_and_restored_when_unassigned(self) -> None:
        program = self._create_program()
        course = crud.create_course(
            self.db,
            schemas.CourseCreate(name="APS500", credits=1.0),
            program.id,
            semester_id=None,
        )
        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "course-resources",
            schemas.ProgramPluginInstallationUpsertRequest(is_enabled=True),
        )
        crud.upsert_course_plugin_activation(
            self.db,
            course.id,
            "course-resources",
            schemas.CoursePluginActivationUpsertRequest(is_enabled=True),
        )
        semester = crud.create_semester(
            self.db,
            schemas.SemesterCreate(
                name="Winter 2026",
                start_date=date(2026, 1, 5),
                end_date=date(2026, 4, 10),
            ),
            program.id,
        )

        crud.update_course(
            self.db,
            course.id,
            schemas.CourseUpdate(semester_id=semester.id),
        )

        semester_governed_plugin_ids = {
            item["plugin_id"]
            for item in crud.get_course_plugin_activations(self.db, course.id)
        }
        self.assertNotIn("course-resources", semester_governed_plugin_ids)

        crud.update_course(
            self.db,
            course.id,
            schemas.CourseUpdate(semester_id=None),
        )

        restored_activations = crud.get_course_plugin_activations(self.db, course.id)
        restored_resources_activation = next(
            item for item in restored_activations if item["plugin_id"] == "course-resources"
        )
        self.assertTrue(restored_resources_activation["is_enabled"])
        self.assertTrue(restored_resources_activation["available"])

    def test_program_disabled_plugins_do_not_appear_in_semester_settings(self) -> None:
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

        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "course-resources",
            schemas.ProgramPluginInstallationUpsertRequest(is_enabled=True),
        )
        crud.upsert_semester_plugin_activation(
            self.db,
            semester.id,
            "course-resources",
            schemas.SemesterPluginActivationUpsertRequest(is_enabled=True),
        )

        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "course-resources",
            schemas.ProgramPluginInstallationUpsertRequest(is_enabled=False),
        )

        semester_activations = crud.get_semester_plugin_activations(self.db, semester.id)

        self.assertNotIn("course-resources", {item["plugin_id"] for item in semester_activations})

    def test_deleting_program_plugin_removes_course_resources_runtime_data(self) -> None:
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

        installation = crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "course-resources",
            schemas.ProgramPluginInstallationUpsertRequest(is_enabled=True),
        )
        crud.upsert_semester_plugin_activation(
            self.db,
            semester.id,
            "course-resources",
            schemas.SemesterPluginActivationUpsertRequest(is_enabled=True),
        )
        self.db.add(
            models.PluginSetting(
                plugin_id="course-resources",
                course_id=course.id,
                settings='{"layout":"grid"}',
            )
        )
        self.db.add(
            models.Widget(
                widget_type="course-resources-quick-open",
                course_id=course.id,
                title="Resources",
                layout_config="{}",
                settings="{}",
                is_removable=True,
            )
        )
        self.db.add(
            models.Tab(
                tab_type="course-resources-tab",
                course_id=course.id,
                settings="{}",
                order_index=1,
                is_removable=True,
                is_draggable=True,
            )
        )
        self.db.add(
            models.CourseResourceFile(
                course_id=course.id,
                filename_original="syllabus.pdf",
                filename_display="syllabus.pdf",
                resource_kind="file",
                external_url=None,
                mime_type="application/pdf",
                size_bytes=128,
                storage_path="tests/course-resources/syllabus.pdf",
                created_at="2026-03-27T10:00:00Z",
                updated_at="2026-03-27T10:00:00Z",
            )
        )
        self.db.commit()

        crud.delete_program_plugin_installation(self.db, program.id, "course-resources")

        self.assertIsNone(
            self.db.query(models.ProgramPluginInstallation).filter(
                models.ProgramPluginInstallation.id == installation["id"]
            ).first()
        )
        self.assertEqual(
            self.db.query(models.SemesterPluginActivation)
            .join(models.ProgramPluginInstallation)
            .filter(
                models.SemesterPluginActivation.semester_id == semester.id,
                models.ProgramPluginInstallation.plugin_id == "course-resources",
            )
            .count(),
            0,
        )
        self.assertEqual(
            self.db.query(models.PluginSetting).filter(
                models.PluginSetting.plugin_id == "course-resources",
                models.PluginSetting.course_id == course.id,
            ).count(),
            0,
        )
        self.assertEqual(
            self.db.query(models.Widget).filter(
                models.Widget.course_id == course.id,
                models.Widget.widget_type == "course-resources-quick-open",
            ).count(),
            0,
        )
        self.assertEqual(
            self.db.query(models.Tab).filter(
                models.Tab.course_id == course.id,
                models.Tab.tab_type == "course-resources-tab",
            ).count(),
            0,
        )
        self.assertEqual(
            self.db.query(models.CourseResourceFile).filter(
                models.CourseResourceFile.course_id == course.id,
            ).count(),
            0,
        )

    def test_deleting_program_plugin_removes_event_core_owned_data(self) -> None:
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

        installation = crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "builtin-event-core",
            schemas.ProgramPluginInstallationUpsertRequest(is_enabled=True),
        )
        crud.upsert_semester_plugin_activation(
            self.db,
            semester.id,
            "builtin-event-core",
            schemas.SemesterPluginActivationUpsertRequest(is_enabled=True),
        )
        self.db.add(
            models.PluginSetting(
                plugin_id="builtin-event-core",
                semester_id=semester.id,
                settings='{"calendarDefaultView":"week"}',
            )
        )
        self.db.add(
            models.Widget(
                widget_type="builtin-today-events",
                semester_id=semester.id,
                title="Today",
                layout_config="{}",
                settings="{}",
                is_removable=True,
            )
        )
        self.db.add(
            models.Tab(
                tab_type="builtin-todo",
                semester_id=semester.id,
                settings="{}",
                order_index=2,
                is_removable=True,
                is_draggable=True,
            )
        )
        todo_section = models.TodoSection(
            semester_id=semester.id,
            name="Week 1",
            created_at="2026-03-27T10:00:00Z",
            updated_at="2026-03-27T10:00:00Z",
        )
        self.db.add(todo_section)
        self.db.flush()
        self.db.add(
            models.TodoTask(
                semester_id=semester.id,
                course_id=course.id,
                section_id=todo_section.id,
                origin_section_id=todo_section.id,
                title="Read notes",
                note="",
                due_date=None,
                due_time=None,
                priority="",
                completed=False,
                created_at="2026-03-27T10:00:00Z",
                updated_at="2026-03-27T10:00:00Z",
            )
        )
        self.db.add(
            models.CourseEventType(
                course_id=course.id,
                code="WORKSHOP",
                abbreviation="WKS",
                track_attendance=False,
                color=None,
                icon=None,
                created_at="2026-03-27T10:00:00Z",
                updated_at="2026-03-27T10:00:00Z",
            )
        )
        self.db.add(
            models.CourseSection(
                course_id=course.id,
                section_id="WKS0101",
                event_type_code="WORKSHOP",
                title="Lecture",
                instructor=None,
                location=None,
                day_of_week=1,
                start_time="09:00",
                end_time="10:00",
                week_pattern="EVERY",
                start_week=1,
                end_week=12,
                created_at="2026-03-27T10:00:00Z",
                updated_at="2026-03-27T10:00:00Z",
            )
        )
        self.db.add(
            models.CourseEvent(
                course_id=course.id,
                event_type_code="WORKSHOP",
                section_id="WKS0101",
                title="Lecture",
                day_of_week=1,
                start_time="09:00",
                end_time="10:00",
                week_pattern="EVERY",
                start_week=1,
                end_week=12,
                enable=True,
                skip=False,
                note=None,
                created_at="2026-03-27T10:00:00Z",
                updated_at="2026-03-27T10:00:00Z",
            )
        )
        self.db.commit()

        crud.delete_program_plugin_installation(self.db, program.id, "builtin-event-core")

        self.assertIsNone(
            self.db.query(models.ProgramPluginInstallation).filter(
                models.ProgramPluginInstallation.id == installation["id"]
            ).first()
        )
        self.assertEqual(
            self.db.query(models.PluginSetting).filter(
                models.PluginSetting.plugin_id == "builtin-event-core",
                models.PluginSetting.semester_id == semester.id,
            ).count(),
            0,
        )
        self.assertEqual(
            self.db.query(models.Widget).filter(
                models.Widget.semester_id == semester.id,
                models.Widget.widget_type == "builtin-today-events",
            ).count(),
            0,
        )
        self.assertEqual(
            self.db.query(models.Tab).filter(
                models.Tab.semester_id == semester.id,
                models.Tab.tab_type == "builtin-todo",
            ).count(),
            0,
        )
        self.assertEqual(
            self.db.query(models.TodoSection).filter(
                models.TodoSection.semester_id == semester.id,
            ).count(),
            0,
        )
        self.assertEqual(
            self.db.query(models.TodoTask).filter(
                models.TodoTask.semester_id == semester.id,
            ).count(),
            0,
        )
        self.assertEqual(
            self.db.query(models.CourseEventType).filter(
                models.CourseEventType.course_id == course.id,
            ).count(),
            0,
        )
        self.assertEqual(
            self.db.query(models.CourseSection).filter(
                models.CourseSection.course_id == course.id,
            ).count(),
            0,
        )
        self.assertEqual(
            self.db.query(models.CourseEvent).filter(
                models.CourseEvent.course_id == course.id,
            ).count(),
            0,
        )

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
                is_enabled=True,
            ),
        )
        crud.update_semester_plugin_system_setup(
            self.db,
            draft["id"],
            "builtin-event-core",
            schemas.PluginSystemSemesterSetupUpdateRequest(
                values={"calendarDefaultView": "week"},
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

    def test_plugin_system_setup_routes_serialize_values_and_review(self) -> None:
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
        crud.upsert_semester_plugin_activation(
            self.db,
            draft["id"],
            "builtin-event-core",
            schemas.SemesterPluginActivationUpsertRequest(is_enabled=True),
        )

        setup_payload = crud.get_semester_plugin_system_setup(self.db, draft["id"])
        event_core_setup = next(plugin for plugin in setup_payload["plugins"] if plugin["plugin_id"] == "builtin-event-core")

        self.assertEqual(event_core_setup["setup_values"]["calendarDefaultView"], "month")
        self.assertEqual(event_core_setup["setup_sections"][0]["fields"][0]["persist"], "both")

        with self.assertRaises(crud.PluginGovernanceError) as context:
            crud.update_semester_plugin_system_setup(
                self.db,
                draft["id"],
                "builtin-event-core",
                schemas.PluginSystemSemesterSetupUpdateRequest(values={}),
            )

        self.assertEqual(context.exception.code, "PLUGIN_SYSTEM_SETUP_REQUIRED")

        updated_setup = crud.update_semester_plugin_system_setup(
            self.db,
            draft["id"],
            "builtin-event-core",
            schemas.PluginSystemSemesterSetupUpdateRequest(
                values={"calendarDefaultView": "week"},
            ),
        )

        self.assertEqual(updated_setup["setup_values"]["calendarDefaultView"], "week")
        self.assertEqual(updated_setup["setup_summary"][0]["items"][0]["value"], "Week")

        activation = self.db.query(models.SemesterPluginActivation).filter(
            models.SemesterPluginActivation.semester_id == draft["id"]
        ).join(models.ProgramPluginInstallation).filter(
            models.ProgramPluginInstallation.plugin_id == "builtin-event-core"
        ).first()
        self.assertEqual(activation.setup_state, '{"calendarDefaultView": "week", "eventTypes": null}')
        self.assertEqual(activation.semester_overrides, '{"calendarDefaultView": "week"}')

        review_payload = crud.review_semester_plugin_system(self.db, draft["id"])
        event_core_review = next(plugin for plugin in review_payload["plugins"] if plugin["plugin_id"] == "builtin-event-core")

        self.assertFalse(review_payload["has_errors"])
        self.assertEqual(event_core_review["setup_summary"][0]["items"][0]["value"], "Week")

if __name__ == "__main__":
    unittest.main()
