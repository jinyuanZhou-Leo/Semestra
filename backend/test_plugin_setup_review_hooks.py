# input:  [unittest, in-memory SQLAlchemy setup, backend CRUD helpers, schemas, plugin registry overrides, and Semester plugin setup persistence contracts]
# output: [backend regression tests proving Semester setup writes are projected into tab-settings storage and review ignores plugin-owned setup-review hooks]
# pos:    [backend unit tests for Semester plugin-setup persistence and review behavior when setup is treated as runtime tab settings rather than a separate validated payload]
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
import plugin_registry
import schemas
from crud_shared import PluginRegistryError


class PluginSetupReviewHookTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        self.testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.testing_session_local()
        self.user = models.User(email="plugin-review-hook@example.com", hashed_password="hashed", user_setting="{}")
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)

        self.original_registry_overrides = dict(plugin_registry.PLUGIN_REGISTRY_OVERRIDES)
        self.original_plugin_definitions = dict(plugin_registry.PLUGIN_DEFINITIONS)
        self.original_setup_definitions = dict(plugin_registry.PLUGIN_SETUP_DEFINITIONS)

    def tearDown(self) -> None:
        plugin_registry.PLUGIN_REGISTRY_OVERRIDES.clear()
        plugin_registry.PLUGIN_REGISTRY_OVERRIDES.update(self.original_registry_overrides)
        plugin_registry.PLUGIN_DEFINITIONS.clear()
        plugin_registry.PLUGIN_DEFINITIONS.update(self.original_plugin_definitions)
        plugin_registry.PLUGIN_SETUP_DEFINITIONS.clear()
        plugin_registry.PLUGIN_SETUP_DEFINITIONS.update(self.original_setup_definitions)
        self.db.close()
        self.engine.dispose()

    def _create_program(self) -> models.Program:
        return crud.create_program(
            self.db,
            schemas.ProgramCreate(name="Engineering"),
            user_id=self.user.id,
        )

    def _register_mock_setup_plugin(self) -> None:
        mode_field = plugin_registry.PluginSetupFieldDefinition(
            path="mode",
            settings_key="mock-primary-tab",
            label="Mode",
            field_type="select",
            required=True,
            default="basic",
            options=(
                {"label": "Basic", "value": "basic"},
                {"label": "Advanced", "value": "advanced"},
            ),
            summary_labels={
                "basic": "Basic",
                "advanced": "Advanced",
            },
        )

        def review_hook(context: plugin_registry.PluginSetupReviewContext) -> plugin_registry.PluginSetupReviewResult:
            semester_name = (context.semester.name if context.semester is not None else "").strip()
            if context.setup_values["mode"] == "advanced" and semester_name != "Honors Winter 2026":
                return plugin_registry.PluginSetupReviewResult(
                    review_errors=(
                        plugin_registry.PluginSetupReviewIssue(
                            code="ADVANCED_MODE_REQUIRES_HONORS_SEMESTER",
                            message="Advanced mode requires the Honors Winter 2026 semester.",
                            field_path="mode",
                        ),
                    ),
                )
            return plugin_registry.PluginSetupReviewResult()

        plugin_registry.PLUGIN_REGISTRY_OVERRIDES["mock-setup-plugin"] = plugin_registry.PluginRegistryDefinition(
            plugin_id="mock-setup-plugin",
            setup_review=review_hook,
        )
        plugin_registry.PLUGIN_DEFINITIONS["mock-setup-plugin"] = plugin_registry.PluginDefinition(
            plugin_id="mock-setup-plugin",
            metadata=plugin_registry.PluginMetadata(
                kind="builtin",
                visibility="public",
                display_name="Mock Setup Plugin",
                description="Test-only plugin-owned setup review hook.",
                long_description="Test-only plugin-owned setup review hook.",
                author="Tests",
                capabilities={
                    "contexts": ["semester"],
                    "available_tab_types": ["mock-primary-tab"],
                },
            ),
            setup_review=review_hook,
        )
        plugin_registry.PLUGIN_SETUP_DEFINITIONS["mock-setup-plugin"] = plugin_registry.PluginSetupDefinition(
            plugin_id="mock-setup-plugin",
            fields=(mode_field,),
            sections=(
                plugin_registry.PluginSetupSectionDefinition(
                    id="mock-setup",
                    title="Mock Setup",
                    fields=(mode_field,),
                ),
            ),
        )

    def _register_multi_tab_setup_plugin(self) -> None:
        title_field = plugin_registry.PluginSetupFieldDefinition(
            path="title",
            settings_key="mock-primary-tab",
            label="Title",
            field_type="text",
            required=True,
            default="Overview",
        )
        accent_field = plugin_registry.PluginSetupFieldDefinition(
            path="accent",
            settings_key="mock-secondary-tab",
            label="Accent",
            field_type="select",
            required=True,
            default="neutral",
            options=(
                {"label": "Neutral", "value": "neutral"},
                {"label": "Contrast", "value": "contrast"},
            ),
            summary_labels={
                "neutral": "Neutral",
                "contrast": "Contrast",
            },
        )
        plugin_registry.PLUGIN_REGISTRY_OVERRIDES["mock-multi-tab-plugin"] = plugin_registry.PluginRegistryDefinition(
            plugin_id="mock-multi-tab-plugin",
        )
        plugin_registry.PLUGIN_DEFINITIONS["mock-multi-tab-plugin"] = plugin_registry.PluginDefinition(
            plugin_id="mock-multi-tab-plugin",
            metadata=plugin_registry.PluginMetadata(
                kind="builtin",
                visibility="public",
                display_name="Mock Multi Tab Plugin",
                description="Test-only plugin with setup fields across multiple tabs.",
                long_description="Test-only plugin with setup fields across multiple tabs.",
                author="Tests",
                capabilities={
                    "contexts": ["semester"],
                    "available_tab_types": ["mock-primary-tab", "mock-secondary-tab"],
                },
            ),
        )
        plugin_registry.PLUGIN_SETUP_DEFINITIONS["mock-multi-tab-plugin"] = plugin_registry.PluginSetupDefinition(
            plugin_id="mock-multi-tab-plugin",
            fields=(title_field, accent_field),
            sections=(
                plugin_registry.PluginSetupSectionDefinition(
                    id="mock-setup",
                    title="Mock Setup",
                    fields=(title_field, accent_field),
                ),
            ),
        )

    def test_semester_review_ignores_plugin_owned_setup_review_hook_errors(self) -> None:
        self._register_mock_setup_plugin()
        program = self._create_program()
        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "mock-setup-plugin",
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
            "mock-setup-plugin",
            schemas.SemesterPluginActivationUpsertRequest(is_enabled=True),
        )
        crud.update_semester_plugin_system_setup(
            self.db,
            draft["id"],
            "mock-setup-plugin",
            schemas.PluginSystemSemesterSetupUpdateRequest(values={"mode": "advanced"}),
        )

        review_payload = crud.review_semester_plugin_system(self.db, draft["id"])
        mock_plugin_review = next(plugin for plugin in review_payload["plugins"] if plugin["plugin_id"] == "mock-setup-plugin")

        self.assertFalse(review_payload["has_errors"])
        self.assertEqual(mock_plugin_review["review_errors"], [])
        self.assertEqual(mock_plugin_review["setup_summary"][0]["items"][0]["value"], "Advanced")

    def test_plugin_setup_updates_write_fields_into_multiple_tab_settings(self) -> None:
        self._register_multi_tab_setup_plugin()
        program = self._create_program()
        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "mock-multi-tab-plugin",
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
            "mock-multi-tab-plugin",
            schemas.SemesterPluginActivationUpsertRequest(is_enabled=True),
        )

        update_payload = crud.update_semester_plugin_system_setup(
            self.db,
            draft["id"],
            "mock-multi-tab-plugin",
            schemas.PluginSystemSemesterSetupUpdateRequest(
                values={
                    "title": "Launch Plan",
                    "accent": "contrast",
                }
            ),
        )

        primary_tab_setting = self.db.query(models.TabSetting).filter(
            models.TabSetting.semester_id == draft["id"],
            models.TabSetting.settings_key == "mock-primary-tab",
        ).first()
        secondary_tab_setting = self.db.query(models.TabSetting).filter(
            models.TabSetting.semester_id == draft["id"],
            models.TabSetting.settings_key == "mock-secondary-tab",
        ).first()

        self.assertIsNotNone(primary_tab_setting)
        self.assertEqual(primary_tab_setting.settings, '{"title": "Launch Plan"}')
        self.assertIsNotNone(secondary_tab_setting)
        self.assertEqual(secondary_tab_setting.settings, '{"accent": "contrast"}')
        self.assertEqual(update_payload["setup_values"]["title"], "Launch Plan")
        self.assertEqual(update_payload["setup_values"]["accent"], "contrast")

        setup_payload = crud.get_semester_plugin_system_setup(self.db, draft["id"])
        multi_tab_plugin = next(plugin for plugin in setup_payload["plugins"] if plugin["plugin_id"] == "mock-multi-tab-plugin")
        self.assertEqual(
            multi_tab_plugin["setup_values"],
            {
                "title": "Launch Plan",
                "accent": "contrast",
            },
        )

    def test_plugin_setup_update_rejects_invalid_field_value_before_persisting(self) -> None:
        self._register_mock_setup_plugin()
        program = self._create_program()
        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "mock-setup-plugin",
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
            "mock-setup-plugin",
            schemas.SemesterPluginActivationUpsertRequest(is_enabled=True),
        )

        with self.assertRaises(PluginRegistryError) as context:
            crud.update_semester_plugin_system_setup(
                self.db,
                draft["id"],
                "mock-setup-plugin",
                schemas.PluginSystemSemesterSetupUpdateRequest(values={"mode": "invalid-option"}),
            )

        self.assertEqual(context.exception.code, "PLUGIN_SYSTEM_SETUP_INVALID")
        persisted_tab_setting = self.db.query(models.TabSetting).filter(
            models.TabSetting.semester_id == draft["id"],
            models.TabSetting.settings_key == "mock-primary-tab",
        ).first()
        self.assertIsNone(persisted_tab_setting)


if __name__ == "__main__":
    unittest.main()
