# input:  [unittest, in-memory SQLAlchemy setup, backend CRUD helpers, schemas, and plugin governance review-hook contracts]
# output: [backend regression tests proving Semester setup review errors can be supplied by plugin-owned review hooks instead of host hardcoding]
# pos:    [backend unit tests for plugin-owned setup review dispatch through the shared Semester draft review pipeline]
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
            if context.setup_values["mode"] == "advanced" and not context.program_settings.get("allowAdvancedMode", False):
                return plugin_registry.PluginSetupReviewResult(
                    review_errors=(
                        plugin_registry.PluginSetupReviewIssue(
                            code="ADVANCED_MODE_REQUIRES_PROGRAM_OPT_IN",
                            message="Advanced mode requires a Program-level opt-in.",
                            field_path="mode",
                        ),
                    ),
                )
            return plugin_registry.PluginSetupReviewResult()

        plugin_registry.PLUGIN_REGISTRY_OVERRIDES["mock-setup-plugin"] = plugin_registry.PluginRegistryDefinition(
            plugin_id="mock-setup-plugin",
            default_settings={"allowAdvancedMode": False},
            fields=(
                plugin_registry.PluginFieldDefinition(
                    path="allowAdvancedMode",
                    label="Allow advanced mode",
                    field_type="boolean",
                    scope=plugin_registry.FIELD_SCOPE_PROGRAM_ONLY,
                    default=False,
                ),
            ),
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
                capabilities={"contexts": ["semester"]},
            ),
            default_settings={"allowAdvancedMode": False},
            fields=(
                plugin_registry.PluginFieldDefinition(
                    path="allowAdvancedMode",
                    label="Allow advanced mode",
                    field_type="boolean",
                    scope=plugin_registry.FIELD_SCOPE_PROGRAM_ONLY,
                    default=False,
                ),
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

    def test_semester_review_uses_plugin_owned_setup_review_hook(self) -> None:
        self._register_mock_setup_plugin()
        program = self._create_program()
        crud.upsert_program_plugin_installation(
            self.db,
            program.id,
            "mock-setup-plugin",
            schemas.ProgramPluginInstallationUpsertRequest(
                program_settings={"allowAdvancedMode": False},
            ),
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

        self.assertTrue(review_payload["has_errors"])
        self.assertEqual(mock_plugin_review["review_errors"][0]["code"], "ADVANCED_MODE_REQUIRES_PROGRAM_OPT_IN")
        self.assertEqual(mock_plugin_review["review_errors"][0]["field_path"], "mode")


if __name__ == "__main__":
    unittest.main()
