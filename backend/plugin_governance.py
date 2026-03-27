# input:  [Program model records, plugin governance payloads, and platform-level availability requirements]
# output: [plugin catalog helpers for Program installs, Semester activation, settings validation, setup summaries, and resolved-config computation]
# pos:    [Backend governance registry for Program-managed plugin lifecycle and Semester-scoped plugin activation rules plus review-time validation helpers]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any


AUTH_NOT_REQUIRED = "not-required"
AUTH_PENDING = "pending"
AUTH_AUTHORIZED = "authorized"
AUTH_FAILED = "failed"

FIELD_SCOPE_PROGRAM_ONLY = "program-only"
FIELD_SCOPE_SEMESTER_OVERRIDE = "semester-override"


class PluginGovernanceValidationError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class PluginFieldDefinition:
    path: str
    label: str
    field_type: str
    scope: str
    default: Any = None
    description: str = ""
    options: tuple[dict[str, Any], ...] = ()


@dataclass(frozen=True)
class PluginSetupFieldDefinition:
    path: str
    label: str
    field_type: str
    default: Any = None
    description: str = ""
    options: tuple[dict[str, Any], ...] = ()


@dataclass(frozen=True)
class PluginSetupSectionDefinition:
    id: str
    title: str
    description: str = ""
    fields: tuple[PluginSetupFieldDefinition, ...] = ()


@dataclass(frozen=True)
class PluginDefinition:
    plugin_id: str
    display_name: str
    description: str
    author: str
    default_version: str = "workspace"
    install_by_default: bool = False
    enable_by_default: bool = False
    is_required: bool = False
    requires_authorization: bool = False
    requires_program_lms_integration: bool = False
    capabilities: dict[str, Any] = field(default_factory=dict)
    default_settings: dict[str, Any] = field(default_factory=dict)
    fields: tuple[PluginFieldDefinition, ...] = ()
    setup_sections: tuple[PluginSetupSectionDefinition, ...] = ()

    @property
    def default_installed(self) -> bool:
        return self.install_by_default

    @property
    def default_enabled(self) -> bool:
        return self.enable_by_default

    @property
    def locked(self) -> bool:
        return self.is_required


PLUGIN_DEFINITIONS: dict[str, PluginDefinition] = {
    "builtin-dashboard": PluginDefinition(
        plugin_id="builtin-dashboard",
        display_name="Dashboard",
        description="Core dashboard tab for workspace overviews and widgets.",
        author="Jinyuan",
        install_by_default=True,
        enable_by_default=True,
        is_required=True,
        capabilities={
            "contexts": ["semester", "course"],
            "available_tab_types": ["dashboard"],
            "available_widget_types": [],
            "has_settings": False,
        },
    ),
    "builtin-settings": PluginDefinition(
        plugin_id="builtin-settings",
        display_name="Settings",
        description="Core settings tab for workspace configuration surfaces.",
        author="Jinyuan",
        install_by_default=True,
        enable_by_default=True,
        is_required=True,
        capabilities={
            "contexts": ["semester", "course"],
            "available_tab_types": ["settings"],
            "available_widget_types": [],
            "has_settings": True,
        },
    ),
    "course-list": PluginDefinition(
        plugin_id="course-list",
        display_name="Course List",
        description="Semester course list widget and course-management defaults.",
        author="Jinyuan",
        install_by_default=True,
        enable_by_default=True,
        capabilities={
            "contexts": ["semester"],
            "available_tab_types": [],
            "available_widget_types": ["course-list"],
            "has_settings": True,
        },
        default_settings={
            "allowCourseCreation": True,
            "badgeStyle": "compact",
        },
        fields=(
            PluginFieldDefinition(
                path="allowCourseCreation",
                label="Allow course creation",
                field_type="boolean",
                scope=FIELD_SCOPE_PROGRAM_ONLY,
                default=True,
                description="Control whether the Course List widget exposes create-course entry points.",
            ),
            PluginFieldDefinition(
                path="badgeStyle",
                label="Badge style",
                field_type="select",
                scope=FIELD_SCOPE_SEMESTER_OVERRIDE,
                default="compact",
                description="Control how dense the course badges feel inside this Semester.",
                options=(
                    {"label": "Compact", "value": "compact"},
                    {"label": "Detailed", "value": "detailed"},
                ),
            ),
        ),
    ),
    "builtin-event-core": PluginDefinition(
        plugin_id="builtin-event-core",
        display_name="Academic Events",
        description="Calendar, course schedule, todo, and daily event surfaces.",
        author="Jinyuan",
        capabilities={
            "contexts": ["semester", "course"],
            "available_tab_types": [
                "builtin-academic-calendar",
                "builtin-course-schedule",
                "builtin-todo",
            ],
            "available_widget_types": ["builtin-today-events"],
            "has_settings": True,
        },
        default_settings={
            "syncLmsCalendar": True,
            "calendarDefaultView": "month",
        },
        fields=(
            PluginFieldDefinition(
                path="syncLmsCalendar",
                label="Sync LMS calendar",
                field_type="boolean",
                scope=FIELD_SCOPE_PROGRAM_ONLY,
                default=True,
                description="Allow Semesters to merge LMS events into Calendar when the Program has LMS configured.",
            ),
            PluginFieldDefinition(
                path="calendarDefaultView",
                label="Calendar default view",
                field_type="select",
                scope=FIELD_SCOPE_SEMESTER_OVERRIDE,
                default="month",
                description="Choose the initial Calendar view for this Semester.",
                options=(
                    {"label": "Month", "value": "month"},
                    {"label": "Week", "value": "week"},
                ),
            ),
        ),
        setup_sections=(
            PluginSetupSectionDefinition(
                id="calendar-setup",
                title="Calendar Setup",
                description="Choose the starting calendar behavior for this Semester.",
                fields=(
                    PluginSetupFieldDefinition(
                        path="calendarDefaultView",
                        label="Default view",
                        field_type="select",
                        default="month",
                        options=(
                            {"label": "Month", "value": "month"},
                            {"label": "Week", "value": "week"},
                        ),
                    ),
                ),
            ),
        ),
    ),
    "builtin-gradebook": PluginDefinition(
        plugin_id="builtin-gradebook",
        display_name="Gradebook",
        description="Course-level gradebook tab and summary widget.",
        author="Jinyuan",
        capabilities={
            "contexts": ["course"],
            "available_tab_types": ["builtin-gradebook"],
            "available_widget_types": ["builtin-gradebook-summary"],
            "has_settings": True,
        },
    ),
    "builtin-canvas-integration": PluginDefinition(
        plugin_id="builtin-canvas-integration",
        display_name="Canvas Integration",
        description="Canvas course navigation and content browsing plugin.",
        author="Jinyuan",
        requires_program_lms_integration=True,
        capabilities={
            "contexts": ["course"],
            "available_tab_types": ["builtin-canvas-integration"],
            "available_widget_types": [],
            "has_settings": False,
        },
    ),
    "course-resources": PluginDefinition(
        plugin_id="course-resources",
        display_name="Course Resources",
        description="Course resources tab and quick-open widget.",
        author="Jinyuan",
        capabilities={
            "contexts": ["course"],
            "available_tab_types": ["course-resources-tab"],
            "available_widget_types": ["course-resources-quick-open"],
            "has_settings": False,
        },
    ),
    "world-clock": PluginDefinition(
        plugin_id="world-clock",
        display_name="World Clock",
        description="Dashboard widget showing selected time zones.",
        author="Jinyuan",
        capabilities={
            "contexts": ["semester", "course"],
            "available_tab_types": [],
            "available_widget_types": ["world-clock"],
            "has_settings": False,
        },
    ),
    "habit-streak": PluginDefinition(
        plugin_id="habit-streak",
        display_name="Habit Streak",
        description="Habit streak widgets for dashboard tracking.",
        author="Jinyuan",
        capabilities={
            "contexts": ["semester", "course"],
            "available_tab_types": [],
            "available_widget_types": ["habit-streak-duolingo", "habit-streak-ring"],
            "has_settings": False,
        },
    ),
    "pomodoro": PluginDefinition(
        plugin_id="pomodoro",
        display_name="Pomodoro",
        description="Pomodoro dashboard widget.",
        author="Jinyuan",
        capabilities={
            "contexts": ["semester", "course"],
            "available_tab_types": [],
            "available_widget_types": ["pomodoro"],
            "has_settings": False,
        },
    ),
    "sticky-note": PluginDefinition(
        plugin_id="sticky-note",
        display_name="Sticky Note",
        description="Sticky-note dashboard widget.",
        author="Jinyuan",
        capabilities={
            "contexts": ["semester", "course"],
            "available_tab_types": [],
            "available_widget_types": ["sticky-note"],
            "has_settings": False,
        },
    ),
    "counter": PluginDefinition(
        plugin_id="counter",
        display_name="Counter",
        description="Counter dashboard widget.",
        author="Jinyuan",
        capabilities={
            "contexts": ["semester", "course"],
            "available_tab_types": [],
            "available_widget_types": ["counter"],
            "has_settings": False,
        },
    ),
    "tab-template": PluginDefinition(
        plugin_id="tab-template",
        display_name="Tab Template",
        description="Template tab plugin used for experimentation.",
        author="Jinyuan",
        capabilities={
            "contexts": ["semester", "course"],
            "available_tab_types": ["tab-template"],
            "available_widget_types": [],
            "has_settings": False,
        },
    ),
}


def list_plugin_definitions() -> list[PluginDefinition]:
    return list(PLUGIN_DEFINITIONS.values())


def get_plugin_definition(plugin_id: str) -> PluginDefinition:
    definition = PLUGIN_DEFINITIONS.get(plugin_id)
    if definition is None:
        raise KeyError(f"Unknown plugin_id '{plugin_id}'.")
    return definition


def get_default_program_plugin_ids() -> list[str]:
    return [definition.plugin_id for definition in list_plugin_definitions() if definition.install_by_default]


def get_default_semester_plugin_ids() -> list[str]:
    return [definition.plugin_id for definition in list_plugin_definitions() if definition.enable_by_default]


def build_field_payloads(plugin_id: str) -> list[dict[str, Any]]:
    definition = get_plugin_definition(plugin_id)
    return [
        {
            "path": field.path,
            "label": field.label,
            "type": field.field_type,
            "scope": field.scope,
            "default": deepcopy(field.default),
            "description": field.description,
            "options": [deepcopy(option) for option in field.options],
        }
        for field in definition.fields
    ]


def build_setup_section_payloads(plugin_id: str) -> list[dict[str, Any]]:
    definition = get_plugin_definition(plugin_id)
    return [
        {
            "id": section.id,
            "title": section.title,
            "description": section.description,
            "fields": [
                {
                    "path": field.path,
                    "label": field.label,
                    "type": field.field_type,
                    "default": deepcopy(field.default),
                    "description": field.description,
                    "options": [deepcopy(option) for option in field.options],
                }
                for field in section.fields
            ],
        }
        for section in definition.setup_sections
    ]


def resolve_plugin_availability(
    plugin_id: str,
    *,
    program_has_lms_integration: bool,
    auth_state: str,
) -> tuple[bool, str | None]:
    definition = get_plugin_definition(plugin_id)
    if definition.requires_program_lms_integration and not program_has_lms_integration:
        return False, "Program LMS integration is required."
    if definition.requires_authorization and auth_state != AUTH_AUTHORIZED:
        return False, "Program authorization is incomplete."
    if auth_state == AUTH_FAILED:
        return False, "Plugin authorization failed."
    return True, None


def _field_map(plugin_id: str) -> dict[str, PluginFieldDefinition]:
    return {field.path: field for field in get_plugin_definition(plugin_id).fields}


def _setup_field_map(plugin_id: str) -> dict[str, PluginSetupFieldDefinition]:
    definition = get_plugin_definition(plugin_id)
    return {
        field.path: field
        for section in definition.setup_sections
        for field in section.fields
    }


def _normalize_field_value(
    *,
    field_type: str,
    field_label: str,
    value: Any,
    options: tuple[dict[str, Any], ...] | tuple[()] = (),
    error_code: str,
) -> Any:
    if field_type == "boolean":
        if isinstance(value, bool):
            return value
        raise PluginGovernanceValidationError(error_code, f"{field_label} must be a boolean.")

    if field_type == "select":
        normalized_value = str(value)
        option_values = {str(option["value"]) for option in options}
        if normalized_value not in option_values:
            allowed_values = ", ".join(sorted(option_values))
            raise PluginGovernanceValidationError(
                error_code,
                f"{field_label} must be one of: {allowed_values}.",
            )
        return normalized_value

    if value is None:
        return ""
    return str(value)


def normalize_program_settings(plugin_id: str, payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    if not isinstance(payload, dict):
        raise PluginGovernanceValidationError("PROGRAM_PLUGIN_SETTINGS_INVALID", "program_settings must be a JSON object.")
    field_map = _field_map(plugin_id)
    unknown_keys = sorted(set(payload.keys()) - set(field_map.keys()))
    if unknown_keys:
        raise PluginGovernanceValidationError(
            "PROGRAM_PLUGIN_SETTINGS_INVALID",
            f"Unknown Program settings keys for {plugin_id}: {', '.join(unknown_keys)}",
        )
    normalized_payload: dict[str, Any] = {}
    for key, value in payload.items():
        field = field_map[key]
        normalized_payload[key] = _normalize_field_value(
            field_type=field.field_type,
            field_label=field.label,
            value=value,
            options=field.options,
            error_code="PROGRAM_PLUGIN_SETTINGS_INVALID",
        )
    return normalized_payload


def normalize_semester_overrides(plugin_id: str, payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    if not isinstance(payload, dict):
        raise PluginGovernanceValidationError("SEMESTER_PLUGIN_OVERRIDES_INVALID", "semester_overrides must be a JSON object.")
    field_map = _field_map(plugin_id)
    unknown_keys = sorted(set(payload.keys()) - set(field_map.keys()))
    if unknown_keys:
        raise PluginGovernanceValidationError(
            "SEMESTER_PLUGIN_OVERRIDES_INVALID",
            f"Unknown Semester override keys for {plugin_id}: {', '.join(unknown_keys)}",
        )
    disallowed = sorted(
        key
        for key, value in payload.items()
        if value is not None and field_map[key].scope != FIELD_SCOPE_SEMESTER_OVERRIDE
    )
    if disallowed:
        raise PluginGovernanceValidationError(
            "SEMESTER_PLUGIN_OVERRIDES_INVALID",
            f"Semester overrides are not allowed for {plugin_id}: {', '.join(disallowed)}",
        )
    normalized_payload: dict[str, Any] = {}
    for key, value in payload.items():
        field = field_map[key]
        normalized_payload[key] = _normalize_field_value(
            field_type=field.field_type,
            field_label=field.label,
            value=value,
            options=field.options,
            error_code="SEMESTER_PLUGIN_OVERRIDES_INVALID",
        )
    return normalized_payload


def normalize_setup_state(plugin_id: str, payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    if not isinstance(payload, dict):
        raise PluginGovernanceValidationError("SEMESTER_PLUGIN_SETUP_INVALID", "setup_state must be a JSON object.")
    setup_field_map = _setup_field_map(plugin_id)
    unknown_keys = sorted(set(payload.keys()) - set(setup_field_map.keys()))
    if unknown_keys:
        raise PluginGovernanceValidationError(
            "SEMESTER_PLUGIN_SETUP_INVALID",
            f"Unknown setup keys for {plugin_id}: {', '.join(unknown_keys)}",
        )
    normalized_payload: dict[str, Any] = {}
    for key, value in payload.items():
        field = setup_field_map[key]
        normalized_payload[key] = _normalize_field_value(
            field_type=field.field_type,
            field_label=field.label,
            value=value,
            options=field.options,
            error_code="SEMESTER_PLUGIN_SETUP_INVALID",
        )
    return normalized_payload


def resolve_plugin_settings(
    plugin_id: str,
    *,
    program_settings: dict[str, Any] | None = None,
    semester_overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    definition = get_plugin_definition(plugin_id)
    resolved = deepcopy(definition.default_settings)
    resolved.update(normalize_program_settings(plugin_id, program_settings))
    resolved.update(normalize_semester_overrides(plugin_id, semester_overrides))
    return resolved


def _stringify_review_value(value: Any) -> str:
    if isinstance(value, bool):
        return "Enabled" if value else "Disabled"
    if value is None:
        return "Not set"
    return str(value)


def build_setup_summary(
    plugin_id: str,
    *,
    resolved_settings: dict[str, Any] | None = None,
    setup_state: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    definition = get_plugin_definition(plugin_id)
    normalized_setup_state = normalize_setup_state(plugin_id, setup_state)
    resolved_settings = resolved_settings or {}
    summary_sections: list[dict[str, Any]] = []

    for section in definition.setup_sections:
        items: list[dict[str, Any]] = []
        for field in section.fields:
            raw_value = normalized_setup_state.get(field.path, resolved_settings.get(field.path, field.default))
            items.append(
                {
                    "path": field.path,
                    "label": field.label,
                    "value": _stringify_review_value(raw_value),
                }
            )
        summary_sections.append(
            {
                "id": section.id,
                "title": section.title,
                "description": section.description,
                "items": items,
            }
        )

    return summary_sections
