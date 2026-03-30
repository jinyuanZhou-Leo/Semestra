# input:  [Program model records, generated plugin metadata/setup manifests, plugin governance payloads, and platform-level availability requirements]
# output: [manifest-backed plugin catalog helpers for Program installs, Semester activation, generated setup definitions, plugin-owned setup review hooks, settings validation, setup summaries, and resolved-config computation with contribution-level context metadata]
# pos:    [Backend governance registry for Program-managed plugin lifecycle and Semester-scoped plugin activation rules plus manifest-backed metadata/setup validation helpers, contribution-level context lookups, and plugin-owned setup review dispatch]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from datetime import date
import json
from pathlib import Path
from typing import Any, Callable


FIELD_SCOPE_PROGRAM_ONLY = "program-only"
FIELD_SCOPE_SEMESTER_OVERRIDE = "semester-override"

SETUP_PERSIST_SETUP_STATE = "setupState"
SETUP_PERSIST_SEMESTER_OVERRIDE = "semesterOverride"
SETUP_PERSIST_BOTH = "both"
VALID_SETUP_PERSIST_VALUES = {
    SETUP_PERSIST_SETUP_STATE,
    SETUP_PERSIST_SEMESTER_OVERRIDE,
    SETUP_PERSIST_BOTH,
}
VALID_SETUP_FIELD_TYPES = {
    "text",
    "textarea",
    "number",
    "boolean",
    "select",
    "date",
    "json",
}

LEGACY_PLUGIN_ID_ALIASES = {
    "builtin-settings": "builtin-setting",
}
HOST_RESERVED_PLUGIN_IDS = {
    "builtin-dashboard",
    "builtin-setting",
}

HOST_RESERVED_TAB_TYPES = {
    "builtin-dashboard",
    "builtin-setting",
}


class PluginGovernanceValidationError(Exception):
    def __init__(self, code: str, message: str, field_path: str | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.field_path = field_path


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
    persist: str
    required: bool = False
    default: Any = None
    description: str = ""
    placeholder: str = ""
    options: tuple[dict[str, Any], ...] = ()
    summary_labels: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class PluginSetupSectionDefinition:
    id: str
    title: str
    description: str = ""
    fields: tuple[PluginSetupFieldDefinition, ...] = ()


@dataclass(frozen=True)
class PluginSetupDefinition:
    plugin_id: str
    fields: tuple[PluginSetupFieldDefinition, ...] = ()
    sections: tuple[PluginSetupSectionDefinition, ...] = ()


@dataclass(frozen=True)
class PluginMetadata:
    display_name: str
    description: str
    author: str
    long_description: str = ""
    capabilities: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class PluginSetupReviewIssue:
    code: str
    message: str
    field_path: str | None = None


@dataclass(frozen=True)
class PluginSetupReviewContext:
    plugin_id: str
    program_settings: dict[str, Any]
    semester_overrides: dict[str, Any]
    setup_state: dict[str, Any]
    resolved_settings: dict[str, Any]
    setup_values: dict[str, Any]
    program: Any = None
    semester: Any = None


@dataclass(frozen=True)
class PluginSetupReviewResult:
    review_errors: tuple[PluginSetupReviewIssue, ...] = ()
    setup_summary: list[dict[str, Any]] | None = None
    resolved_settings: dict[str, Any] | None = None
    setup_values: dict[str, Any] | None = None


PluginSetupReviewCallback = Callable[[PluginSetupReviewContext], PluginSetupReviewResult | None]


@dataclass(frozen=True)
class PluginGovernanceDefinition:
    plugin_id: str
    default_version: str = "workspace"
    install_by_default: bool = False
    enable_by_default: bool = False
    is_required: bool = False
    requires_authorization: bool = False
    requires_program_lms_integration: bool = False
    default_settings: dict[str, Any] = field(default_factory=dict)
    fields: tuple[PluginFieldDefinition, ...] = ()
    setup_review: PluginSetupReviewCallback | None = None


@dataclass(frozen=True)
class PluginDefinition:
    plugin_id: str
    metadata: PluginMetadata
    default_version: str = "workspace"
    install_by_default: bool = False
    enable_by_default: bool = False
    is_required: bool = False
    requires_authorization: bool = False
    requires_program_lms_integration: bool = False
    capabilities: dict[str, Any] = field(default_factory=dict)
    default_settings: dict[str, Any] = field(default_factory=dict)
    fields: tuple[PluginFieldDefinition, ...] = ()
    setup_review: PluginSetupReviewCallback | None = None

    @property
    def display_name(self) -> str:
        return self.metadata.display_name

    @property
    def description(self) -> str:
        return self.metadata.description

    @property
    def author(self) -> str:
        return self.metadata.author

    @property
    def long_description(self) -> str:
        return self.metadata.long_description

    @property
    def default_installed(self) -> bool:
        return self.install_by_default

    @property
    def default_enabled(self) -> bool:
        return self.enable_by_default

    @property
    def locked(self) -> bool:
        return self.is_required


PLUGIN_GOVERNANCE_DEFINITIONS: dict[str, PluginGovernanceDefinition] = {
    "builtin-dashboard": PluginGovernanceDefinition(
        plugin_id="builtin-dashboard",
        install_by_default=True,
        enable_by_default=True,
        is_required=True,
    ),
    "builtin-setting": PluginGovernanceDefinition(
        plugin_id="builtin-setting",
        install_by_default=True,
        enable_by_default=True,
        is_required=True,
    ),
    "course-list": PluginGovernanceDefinition(
        plugin_id="course-list",
        install_by_default=True,
        enable_by_default=True,
        is_required=True,
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
    "builtin-event-core": PluginGovernanceDefinition(
        plugin_id="builtin-event-core",
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
    ),
    "builtin-gradebook": PluginGovernanceDefinition(
        plugin_id="builtin-gradebook",
    ),
    "builtin-canvas-integration": PluginGovernanceDefinition(
        plugin_id="builtin-canvas-integration",
        requires_program_lms_integration=True,
    ),
    "course-resources": PluginGovernanceDefinition(
        plugin_id="course-resources",
    ),
    "world-clock": PluginGovernanceDefinition(
        plugin_id="world-clock",
    ),
    "habit-streak": PluginGovernanceDefinition(
        plugin_id="habit-streak",
    ),
    "pomodoro": PluginGovernanceDefinition(
        plugin_id="pomodoro",
    ),
    "sticky-note": PluginGovernanceDefinition(
        plugin_id="sticky-note",
    ),
    "counter": PluginGovernanceDefinition(
        plugin_id="counter",
    ),
    "tab-template": PluginGovernanceDefinition(
        plugin_id="tab-template",
    ),
}


def _generated_metadata_manifest_path() -> Path:
    return Path(__file__).resolve().parent / "generated" / "plugin_metadata_manifest.json"


def _load_generated_plugin_metadata_manifest() -> list[dict[str, Any]]:
    manifest_path = _generated_metadata_manifest_path()
    if not manifest_path.exists():
        _raise_manifest_error(
            f"Missing generated plugin metadata manifest at '{manifest_path}'. Run `npm --prefix frontend run generate-plugin-setup-manifest`."
        )
    try:
        raw_value = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - startup failure path
        _raise_manifest_error(f"Failed to parse generated plugin metadata manifest: {exc}.")
    if not isinstance(raw_value, list):
        _raise_manifest_error("Generated plugin metadata manifest must be a JSON array.")
    return raw_value


def _load_manifest_string_list(
    plugin_id: str,
    field_name: str,
    raw_value: Any,
) -> list[str]:
    if not isinstance(raw_value, list):
        _raise_manifest_error(f"Generated plugin metadata manifest entry '{plugin_id}' field '{field_name}' must be a JSON array.")
    normalized_values: list[str] = []
    seen_values: set[str] = set()
    for raw_item in raw_value:
        if not isinstance(raw_item, str) or not raw_item.strip():
            _raise_manifest_error(
                f"Generated plugin metadata manifest entry '{plugin_id}' field '{field_name}' must contain non-empty strings."
            )
        if raw_item in seen_values:
            _raise_manifest_error(
                f"Generated plugin metadata manifest entry '{plugin_id}' field '{field_name}' repeats value '{raw_item}'."
            )
        seen_values.add(raw_item)
        normalized_values.append(raw_item)
    return normalized_values


def _load_manifest_context_map(
    plugin_id: str,
    field_name: str,
    raw_value: Any,
    *,
    expected_keys: list[str],
) -> dict[str, list[str]]:
    if not isinstance(raw_value, dict):
        _raise_manifest_error(
            f"Generated plugin metadata manifest entry '{plugin_id}' field '{field_name}' must be an object."
        )
    normalized_map: dict[str, list[str]] = {}
    for raw_key, raw_contexts in raw_value.items():
        if not isinstance(raw_key, str) or not raw_key.strip():
            _raise_manifest_error(
                f"Generated plugin metadata manifest entry '{plugin_id}' field '{field_name}' must use non-empty string keys."
            )
        normalized_map[raw_key] = _load_manifest_string_list(
            plugin_id,
            f"{field_name}.{raw_key}",
            raw_contexts,
        )

    expected_key_set = set(expected_keys)
    actual_key_set = set(normalized_map.keys())
    if actual_key_set != expected_key_set:
        missing_keys = sorted(expected_key_set - actual_key_set)
        extra_keys = sorted(actual_key_set - expected_key_set)
        detail_parts: list[str] = []
        if missing_keys:
            detail_parts.append(f"missing keys {missing_keys}")
        if extra_keys:
            detail_parts.append(f"unexpected keys {extra_keys}")
        _raise_manifest_error(
            f"Generated plugin metadata manifest entry '{plugin_id}' field '{field_name}' does not match declared contribution types: {', '.join(detail_parts)}."
        )
    return normalized_map


def _load_manifest_capabilities(plugin_id: str, raw_capabilities: Any) -> dict[str, Any]:
    if not isinstance(raw_capabilities, dict):
        _raise_manifest_error(f"Generated plugin metadata manifest entry '{plugin_id}' is missing capabilities.")
    has_settings = raw_capabilities.get("has_settings")
    supports_unassigned_course = raw_capabilities.get("supports_unassigned_course")
    if not isinstance(has_settings, bool):
        _raise_manifest_error(
            f"Generated plugin metadata manifest entry '{plugin_id}' capability 'has_settings' must be a boolean."
        )
    if not isinstance(supports_unassigned_course, bool):
        _raise_manifest_error(
            f"Generated plugin metadata manifest entry '{plugin_id}' capability 'supports_unassigned_course' must be a boolean."
        )
    contexts = _load_manifest_string_list(plugin_id, "capabilities.contexts", raw_capabilities.get("contexts"))
    available_tab_types = _load_manifest_string_list(
        plugin_id,
        "capabilities.available_tab_types",
        raw_capabilities.get("available_tab_types"),
    )
    available_widget_types = _load_manifest_string_list(
        plugin_id,
        "capabilities.available_widget_types",
        raw_capabilities.get("available_widget_types"),
    )
    return {
        "contexts": contexts,
        "available_tab_types": available_tab_types,
        "available_widget_types": available_widget_types,
        "tab_allowed_contexts": _load_manifest_context_map(
            plugin_id,
            "capabilities.tab_allowed_contexts",
            raw_capabilities.get("tab_allowed_contexts"),
            expected_keys=available_tab_types,
        ),
        "widget_allowed_contexts": _load_manifest_context_map(
            plugin_id,
            "capabilities.widget_allowed_contexts",
            raw_capabilities.get("widget_allowed_contexts"),
            expected_keys=available_widget_types,
        ),
        "has_settings": has_settings,
        "supports_unassigned_course": supports_unassigned_course,
    }


def _load_generated_plugin_metadata() -> dict[str, PluginMetadata]:
    raw_manifest = _load_generated_plugin_metadata_manifest()
    metadata_by_plugin_id: dict[str, PluginMetadata] = {}

    for raw_entry in raw_manifest:
        if not isinstance(raw_entry, dict):
            _raise_manifest_error("Generated plugin metadata manifest contains a non-object entry.")
        plugin_id = raw_entry.get("plugin_id")
        display_name = raw_entry.get("display_name")
        description = raw_entry.get("description")
        long_description = raw_entry.get("long_description")
        author = raw_entry.get("author")
        capabilities = raw_entry.get("capabilities")

        if not isinstance(plugin_id, str) or not plugin_id.strip():
            _raise_manifest_error("Generated plugin metadata manifest entry is missing plugin_id.")
        if not isinstance(display_name, str) or not display_name.strip():
            _raise_manifest_error(f"Generated plugin metadata manifest entry '{plugin_id}' is missing display_name.")
        if not isinstance(description, str) or not description.strip():
            _raise_manifest_error(f"Generated plugin metadata manifest entry '{plugin_id}' is missing description.")
        if not isinstance(long_description, str) or not long_description.strip():
            _raise_manifest_error(f"Generated plugin metadata manifest entry '{plugin_id}' is missing long_description.")
        if not isinstance(author, str) or not author.strip():
            _raise_manifest_error(f"Generated plugin metadata manifest entry '{plugin_id}' is missing author.")
        if plugin_id in metadata_by_plugin_id:
            _raise_manifest_error(f"Generated plugin metadata manifest repeats plugin_id '{plugin_id}'.")
        metadata_by_plugin_id[plugin_id] = PluginMetadata(
            display_name=display_name,
            description=description,
            long_description=long_description,
            author=author,
            capabilities=_load_manifest_capabilities(plugin_id, capabilities),
        )

    return metadata_by_plugin_id


PLUGIN_METADATA = _load_generated_plugin_metadata()


def _build_plugin_definitions(
    governance_definitions: dict[str, PluginGovernanceDefinition],
    metadata_by_plugin_id: dict[str, PluginMetadata],
) -> dict[str, PluginDefinition]:
    runtime_definitions: dict[str, PluginDefinition] = {}
    all_plugin_ids = sorted(
        (set(governance_definitions.keys()) | set(metadata_by_plugin_id.keys())) - HOST_RESERVED_PLUGIN_IDS
    )

    for plugin_id in all_plugin_ids:
        governance = governance_definitions.get(plugin_id)
        metadata = metadata_by_plugin_id.get(plugin_id)
        if metadata is None:
            _raise_manifest_error(f"Generated plugin metadata manifest is missing plugin_id '{plugin_id}'.")

        runtime_definitions[plugin_id] = PluginDefinition(
            plugin_id=plugin_id,
            metadata=metadata,
            default_version=governance.default_version if governance is not None else "workspace",
            install_by_default=governance.install_by_default if governance is not None else False,
            enable_by_default=governance.enable_by_default if governance is not None else False,
            is_required=governance.is_required if governance is not None else False,
            requires_authorization=governance.requires_authorization if governance is not None else False,
            requires_program_lms_integration=governance.requires_program_lms_integration if governance is not None else False,
            capabilities=deepcopy(metadata.capabilities),
            default_settings=deepcopy(governance.default_settings) if governance is not None else {},
            fields=governance.fields if governance is not None else (),
            setup_review=governance.setup_review if governance is not None else None,
        )

    return runtime_definitions


PLUGIN_DEFINITIONS = _build_plugin_definitions(PLUGIN_GOVERNANCE_DEFINITIONS, PLUGIN_METADATA)
TAB_TYPE_TO_PLUGIN_ID = {
    tab_type: plugin_id
    for plugin_id, definition in PLUGIN_DEFINITIONS.items()
    for tab_type in definition.capabilities.get("available_tab_types", [])
    if tab_type not in HOST_RESERVED_TAB_TYPES
}
WIDGET_TYPE_TO_PLUGIN_ID = {
    widget_type: plugin_id
    for plugin_id, definition in PLUGIN_DEFINITIONS.items()
    for widget_type in definition.capabilities.get("available_widget_types", [])
}


def _raise_manifest_error(message: str) -> None:
    raise RuntimeError(f"[plugin-governance] {message}")


def _generated_manifest_path() -> Path:
    return Path(__file__).resolve().parent / "generated" / "plugin_setup_manifest.json"


def _load_generated_plugin_setup_manifest() -> list[dict[str, Any]]:
    manifest_path = _generated_manifest_path()
    if not manifest_path.exists():
        _raise_manifest_error(
            f"Missing generated plugin setup manifest at '{manifest_path}'. Run `npm --prefix frontend run generate-plugin-setup-manifest`."
        )
    try:
        raw_value = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - startup failure path
        _raise_manifest_error(f"Failed to parse generated plugin setup manifest: {exc}.")
    if not isinstance(raw_value, list):
        _raise_manifest_error("Generated plugin setup manifest must be a JSON array.")
    return raw_value


def _load_manifest_field(
    plugin_id: str,
    raw_field: dict[str, Any],
) -> PluginSetupFieldDefinition:
    path = raw_field.get("path")
    label = raw_field.get("label")
    field_type = raw_field.get("type")
    persist = raw_field.get("persist")
    required = bool(raw_field.get("required", False))
    description = raw_field.get("description") or ""
    placeholder = raw_field.get("placeholder") or ""
    default_value = deepcopy(raw_field.get("default_value"))
    raw_options = raw_field.get("options") or []
    raw_summary_labels = raw_field.get("summary_labels") or {}

    if not isinstance(path, str) or not path.strip():
        _raise_manifest_error(f"Plugin '{plugin_id}' setup field is missing a non-empty path.")
    if not isinstance(label, str) or not label.strip():
        _raise_manifest_error(f"Plugin '{plugin_id}' setup field '{path}' is missing a non-empty label.")
    if field_type not in VALID_SETUP_FIELD_TYPES:
        _raise_manifest_error(f"Plugin '{plugin_id}' setup field '{path}' uses unsupported type '{field_type}'.")
    if persist not in VALID_SETUP_PERSIST_VALUES:
        _raise_manifest_error(f"Plugin '{plugin_id}' setup field '{path}' uses unsupported persist '{persist}'.")
    if not isinstance(raw_options, list):
        _raise_manifest_error(f"Plugin '{plugin_id}' setup field '{path}' options must be a JSON array.")
    if not isinstance(raw_summary_labels, dict):
        _raise_manifest_error(f"Plugin '{plugin_id}' setup field '{path}' summary_labels must be a JSON object.")

    options: list[dict[str, Any]] = []
    option_values: set[str] = set()
    for raw_option in raw_options:
        if not isinstance(raw_option, dict):
            _raise_manifest_error(f"Plugin '{plugin_id}' setup field '{path}' has a non-object option.")
        option_label = raw_option.get("label")
        option_value = raw_option.get("value")
        if not isinstance(option_label, str) or not option_label.strip():
            _raise_manifest_error(f"Plugin '{plugin_id}' setup field '{path}' has an option with an empty label.")
        if not isinstance(option_value, str) or not option_value.strip():
            _raise_manifest_error(f"Plugin '{plugin_id}' setup field '{path}' has an option with an empty value.")
        if option_value in option_values:
            _raise_manifest_error(f"Plugin '{plugin_id}' setup field '{path}' repeats option value '{option_value}'.")
        option_values.add(option_value)
        options.append({"label": option_label, "value": option_value})

    if field_type == "select" and not options:
        _raise_manifest_error(f"Plugin '{plugin_id}' setup field '{path}' is select but does not declare options.")

    summary_labels = {str(key): str(value) for key, value in raw_summary_labels.items()}

    return PluginSetupFieldDefinition(
        path=path,
        label=label,
        field_type=field_type,
        persist=persist,
        required=required,
        default=default_value,
        description=str(description),
        placeholder=str(placeholder),
        options=tuple(options),
        summary_labels=summary_labels,
    )


def _load_plugin_setup_definitions() -> dict[str, PluginSetupDefinition]:
    raw_manifest = _load_generated_plugin_setup_manifest()
    definitions: dict[str, PluginSetupDefinition] = {}

    for raw_entry in raw_manifest:
        if not isinstance(raw_entry, dict):
            _raise_manifest_error("Generated plugin setup manifest contains a non-object entry.")
        plugin_id = raw_entry.get("plugin_id")
        raw_fields = raw_entry.get("fields") or []
        raw_sections = raw_entry.get("sections") or []

        if not isinstance(plugin_id, str) or not plugin_id.strip():
            _raise_manifest_error("Generated plugin setup manifest entry is missing plugin_id.")
        if plugin_id not in PLUGIN_DEFINITIONS:
            _raise_manifest_error(f"Generated plugin setup manifest references unknown plugin_id '{plugin_id}'.")
        if plugin_id in definitions:
            _raise_manifest_error(f"Generated plugin setup manifest repeats plugin_id '{plugin_id}'.")
        if not isinstance(raw_fields, list):
            _raise_manifest_error(f"Generated plugin setup manifest entry '{plugin_id}' has non-array fields.")
        if not isinstance(raw_sections, list):
            _raise_manifest_error(f"Generated plugin setup manifest entry '{plugin_id}' has non-array sections.")

        field_order: list[str] = []
        field_map: dict[str, PluginSetupFieldDefinition] = {}
        for raw_field in raw_fields:
            if not isinstance(raw_field, dict):
                _raise_manifest_error(f"Generated plugin setup manifest entry '{plugin_id}' contains a non-object field.")
            field_definition = _load_manifest_field(plugin_id, raw_field)
            if field_definition.path in field_map:
                _raise_manifest_error(f"Generated plugin setup manifest entry '{plugin_id}' repeats field '{field_definition.path}'.")
            field_map[field_definition.path] = field_definition
            field_order.append(field_definition.path)

        sections: list[PluginSetupSectionDefinition] = []
        section_ids: set[str] = set()
        for raw_section in raw_sections:
            if not isinstance(raw_section, dict):
                _raise_manifest_error(f"Generated plugin setup manifest entry '{plugin_id}' contains a non-object section.")
            section_id = raw_section.get("id")
            section_title = raw_section.get("title")
            section_description = raw_section.get("description") or ""
            section_fields = raw_section.get("fields") or []
            if not isinstance(section_id, str) or not section_id.strip():
                _raise_manifest_error(f"Generated plugin setup manifest entry '{plugin_id}' has a section with an empty id.")
            if section_id in section_ids:
                _raise_manifest_error(f"Generated plugin setup manifest entry '{plugin_id}' repeats section id '{section_id}'.")
            section_ids.add(section_id)
            if not isinstance(section_title, str) or not section_title.strip():
                _raise_manifest_error(f"Generated plugin setup manifest entry '{plugin_id}' section '{section_id}' has an empty title.")
            if not isinstance(section_fields, list) or not section_fields:
                _raise_manifest_error(f"Generated plugin setup manifest entry '{plugin_id}' section '{section_id}' must declare fields.")

            normalized_section_fields: list[PluginSetupFieldDefinition] = []
            section_paths: set[str] = set()
            for raw_section_field in section_fields:
                if not isinstance(raw_section_field, dict):
                    _raise_manifest_error(
                        f"Generated plugin setup manifest entry '{plugin_id}' section '{section_id}' contains a non-object field."
                    )
                field_path = raw_section_field.get("path")
                if not isinstance(field_path, str) or field_path not in field_map:
                    _raise_manifest_error(
                        f"Generated plugin setup manifest entry '{plugin_id}' section '{section_id}' references unknown field '{field_path}'."
                    )
                if field_path in section_paths:
                    _raise_manifest_error(
                        f"Generated plugin setup manifest entry '{plugin_id}' section '{section_id}' repeats field '{field_path}'."
                    )
                section_paths.add(field_path)

                section_field_definition = _load_manifest_field(plugin_id, raw_section_field)
                if section_field_definition != field_map[field_path]:
                    _raise_manifest_error(
                        f"Generated plugin setup manifest entry '{plugin_id}' section '{section_id}' field '{field_path}' diverges from the top-level field definition."
                    )
                normalized_section_fields.append(field_map[field_path])

            sections.append(
                PluginSetupSectionDefinition(
                    id=section_id,
                    title=section_title,
                    description=str(section_description),
                    fields=tuple(normalized_section_fields),
                )
            )

        definitions[plugin_id] = PluginSetupDefinition(
            plugin_id=plugin_id,
            fields=tuple(field_map[path] for path in field_order),
            sections=tuple(sections),
        )

    return definitions


PLUGIN_SETUP_DEFINITIONS = _load_plugin_setup_definitions()


def is_host_reserved_plugin(plugin_id: str) -> bool:
    return normalize_plugin_id(plugin_id) in HOST_RESERVED_PLUGIN_IDS


def list_plugin_definitions(*, include_host_reserved: bool = False) -> list[PluginDefinition]:
    definitions = list(PLUGIN_DEFINITIONS.values())
    if include_host_reserved:
        return definitions
    return [definition for definition in definitions if not is_host_reserved_plugin(definition.plugin_id)]


def normalize_plugin_id(plugin_id: str) -> str:
    normalized_plugin_id = (plugin_id or "").strip()
    return LEGACY_PLUGIN_ID_ALIASES.get(normalized_plugin_id, normalized_plugin_id)


def get_plugin_definition(plugin_id: str) -> PluginDefinition:
    definition = PLUGIN_DEFINITIONS.get(normalize_plugin_id(plugin_id))
    if definition is None:
        raise KeyError(f"Unknown plugin_id '{plugin_id}'.")
    return definition


def is_host_reserved_plugin_id(plugin_id: str) -> bool:
    return normalize_plugin_id(plugin_id) in HOST_RESERVED_PLUGIN_IDS


def is_host_reserved_tab_type(tab_type: str) -> bool:
    return (tab_type or "").strip() in HOST_RESERVED_TAB_TYPES


def get_plugin_id_for_tab_type(tab_type: str) -> str | None:
    return TAB_TYPE_TO_PLUGIN_ID.get((tab_type or "").strip())


def get_plugin_id_for_widget_type(widget_type: str) -> str | None:
    return WIDGET_TYPE_TO_PLUGIN_ID.get((widget_type or "").strip())


def get_plugin_setup_definition(plugin_id: str) -> PluginSetupDefinition | None:
    return PLUGIN_SETUP_DEFINITIONS.get(normalize_plugin_id(plugin_id))


def has_plugin_setup_definition(plugin_id: str) -> bool:
    return normalize_plugin_id(plugin_id) in PLUGIN_SETUP_DEFINITIONS


def get_default_program_plugin_ids() -> list[str]:
    return [
        definition.plugin_id
        for definition in list_plugin_definitions()
        if definition.install_by_default
    ]


def get_default_semester_plugin_ids() -> list[str]:
    return [
        definition.plugin_id
        for definition in list_plugin_definitions()
        if definition.enable_by_default
    ]


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


def _build_plugin_setup_field_payload(field: PluginSetupFieldDefinition) -> dict[str, Any]:
    return {
        "path": field.path,
        "label": field.label,
        "type": field.field_type,
        "persist": field.persist,
        "required": field.required,
        "default_value": deepcopy(field.default),
        "description": field.description,
        "placeholder": field.placeholder,
        "options": [deepcopy(option) for option in field.options],
        "summary_labels": deepcopy(field.summary_labels),
    }


def build_plugin_setup_sections(plugin_id: str) -> list[dict[str, Any]]:
    definition = get_plugin_setup_definition(plugin_id)
    if definition is None:
        return []
    return [
        {
            "id": section.id,
            "title": section.title,
            "description": section.description,
            "fields": [_build_plugin_setup_field_payload(field) for field in section.fields],
        }
        for section in definition.sections
    ]


def build_setup_section_payloads(plugin_id: str) -> list[dict[str, Any]]:
    return build_plugin_setup_sections(plugin_id)


def resolve_plugin_availability(
    plugin_id: str,
    *,
    program_has_lms_integration: bool,
    auth_state: str,
) -> tuple[bool, str | None]:
    definition = get_plugin_definition(plugin_id)
    if definition.requires_program_lms_integration and not program_has_lms_integration:
        return False, "Program LMS integration is required."
    if definition.requires_authorization and auth_state != "authorized":
        return False, "Program authorization is incomplete."
    if auth_state == "failed":
        return False, "Plugin authorization failed."
    return True, None


def _field_map(plugin_id: str) -> dict[str, PluginFieldDefinition]:
    return {field.path: field for field in get_plugin_definition(plugin_id).fields}


def _setup_field_map(plugin_id: str) -> dict[str, PluginSetupFieldDefinition]:
    definition = get_plugin_setup_definition(plugin_id)
    if definition is None:
        return {}
    return {field.path: field for field in definition.fields}


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

    if field_type == "number":
        if value is None:
            return None
        if isinstance(value, bool):
            raise PluginGovernanceValidationError(error_code, f"{field_label} must be a number.")
        if isinstance(value, (int, float)):
            return value
        if isinstance(value, str):
            stripped_value = value.strip()
            if not stripped_value:
                return None
            try:
                parsed_value = float(stripped_value)
            except ValueError as exc:
                raise PluginGovernanceValidationError(error_code, f"{field_label} must be a number.") from exc
            if parsed_value.is_integer() and "." not in stripped_value and "e" not in stripped_value.lower():
                return int(parsed_value)
            return parsed_value
        raise PluginGovernanceValidationError(error_code, f"{field_label} must be a number.")

    if field_type == "date":
        if value is None:
            return ""
        normalized_value = str(value).strip()
        if not normalized_value:
            return ""
        try:
            date.fromisoformat(normalized_value)
        except ValueError as exc:
            raise PluginGovernanceValidationError(error_code, f"{field_label} must use YYYY-MM-DD format.") from exc
        return normalized_value

    if field_type == "json":
        if value is None:
            return None
        if isinstance(value, str):
            stripped_value = value.strip()
            if not stripped_value:
                return None
            try:
                return json.loads(stripped_value)
            except json.JSONDecodeError as exc:
                raise PluginGovernanceValidationError(error_code, f"{field_label} must be valid JSON.") from exc
        try:
            json.dumps(value)
        except TypeError as exc:
            raise PluginGovernanceValidationError(error_code, f"{field_label} must be valid JSON.") from exc
        return deepcopy(value)

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


def _is_missing_setup_value(field: PluginSetupFieldDefinition, value: Any) -> bool:
    if value is None:
        return True
    if field.field_type in {"text", "textarea", "select", "date"}:
        return isinstance(value, str) and value.strip() == ""
    return False


def _normalize_plugin_setup_value(field: PluginSetupFieldDefinition, value: Any) -> Any:
    try:
        return _normalize_field_value(
            field_type=field.field_type,
            field_label=field.label,
            value=value,
            options=field.options,
            error_code="PLUGIN_SYSTEM_SETUP_INVALID",
        )
    except PluginGovernanceValidationError as exc:
        raise PluginGovernanceValidationError(exc.code, exc.message, field_path=field.path) from exc


def _validate_plugin_setup_values(
    plugin_id: str,
    values: dict[str, Any] | None,
    *,
    require_explicit_required_fields: bool,
) -> dict[str, Any]:
    definition = get_plugin_setup_definition(plugin_id)
    if definition is None:
        if values:
            raise PluginGovernanceValidationError(
                "PLUGIN_SYSTEM_SETUP_DEFINITION_NOT_FOUND",
                f"Plugin '{plugin_id}' does not declare setup fields.",
            )
        return {}
    if not isinstance(values, dict):
        raise PluginGovernanceValidationError("PLUGIN_SYSTEM_SETUP_INVALID", "values must be a JSON object.")

    field_map = _setup_field_map(plugin_id)
    unknown_keys = sorted(set(values.keys()) - set(field_map.keys()))
    if unknown_keys:
        raise PluginGovernanceValidationError(
            "PLUGIN_SYSTEM_SETUP_UNKNOWN_FIELD",
            f"Unknown plugin setup keys for {plugin_id}: {', '.join(unknown_keys)}",
        )

    normalized_values: dict[str, Any] = {}
    for field in definition.fields:
        has_explicit_value = field.path in values
        raw_value = values[field.path] if has_explicit_value else deepcopy(field.default)
        if require_explicit_required_fields and field.required and not has_explicit_value:
            raise PluginGovernanceValidationError(
                "PLUGIN_SYSTEM_SETUP_REQUIRED",
                f"{field.label} is required.",
                field_path=field.path,
            )
        normalized_value = _normalize_plugin_setup_value(field, raw_value)
        if field.required and _is_missing_setup_value(field, normalized_value):
            raise PluginGovernanceValidationError(
                "PLUGIN_SYSTEM_SETUP_REQUIRED",
                f"{field.label} is required.",
                field_path=field.path,
            )
        normalized_values[field.path] = deepcopy(normalized_value)

    return normalized_values


def resolve_plugin_setup_values(
    plugin_id: str,
    *,
    semester_overrides: dict[str, Any] | None = None,
    setup_state: dict[str, Any] | None = None,
) -> dict[str, Any]:
    definition = get_plugin_setup_definition(plugin_id)
    if definition is None:
        return {}

    normalized_overrides = normalize_semester_overrides(plugin_id, semester_overrides)
    normalized_setup_state = normalize_setup_state(plugin_id, setup_state)
    resolved_values: dict[str, Any] = {}

    for field in definition.fields:
        fallback_value = deepcopy(field.default)
        if field.persist == SETUP_PERSIST_SETUP_STATE:
            resolved_values[field.path] = deepcopy(normalized_setup_state.get(field.path, fallback_value))
        elif field.persist == SETUP_PERSIST_SEMESTER_OVERRIDE:
            resolved_values[field.path] = deepcopy(normalized_overrides.get(field.path, fallback_value))
        else:
            resolved_values[field.path] = deepcopy(
                normalized_setup_state.get(field.path, normalized_overrides.get(field.path, fallback_value))
            )

    return resolved_values


def validate_plugin_setup_values(plugin_id: str, values: dict[str, Any] | None) -> dict[str, Any]:
    return _validate_plugin_setup_values(plugin_id, values, require_explicit_required_fields=True)


def validate_resolved_plugin_setup_values(plugin_id: str, values: dict[str, Any] | None) -> dict[str, Any]:
    return _validate_plugin_setup_values(plugin_id, values, require_explicit_required_fields=False)


def review_plugin_setup(
    plugin_id: str,
    *,
    program_settings: dict[str, Any] | None = None,
    semester_overrides: dict[str, Any] | None = None,
    setup_state: dict[str, Any] | None = None,
    program: Any = None,
    semester: Any = None,
) -> dict[str, Any]:
    normalized_program_settings = normalize_program_settings(plugin_id, program_settings)
    normalized_overrides = normalize_semester_overrides(plugin_id, semester_overrides)
    normalized_setup_state = normalize_setup_state(plugin_id, setup_state)
    resolved_settings = resolve_plugin_settings(
        plugin_id,
        program_settings=normalized_program_settings,
        semester_overrides=normalized_overrides,
    )
    setup_values = validate_resolved_plugin_setup_values(
        plugin_id,
        resolve_plugin_setup_values(
            plugin_id,
            semester_overrides=normalized_overrides,
            setup_state=normalized_setup_state,
        ),
    )
    setup_summary = build_plugin_setup_summary(
        plugin_id,
        setup_values=setup_values,
    )
    review_errors: list[PluginSetupReviewIssue] = []

    definition = get_plugin_definition(plugin_id)
    if definition.setup_review is not None:
        review_context = PluginSetupReviewContext(
            plugin_id=plugin_id,
            program_settings=deepcopy(normalized_program_settings),
            semester_overrides=deepcopy(normalized_overrides),
            setup_state=deepcopy(normalized_setup_state),
            resolved_settings=deepcopy(resolved_settings),
            setup_values=deepcopy(setup_values),
            program=program,
            semester=semester,
        )
        review_result = definition.setup_review(review_context)
        if review_result is not None:
            if review_result.resolved_settings is not None:
                resolved_settings = deepcopy(review_result.resolved_settings)
            if review_result.setup_values is not None:
                setup_values = validate_resolved_plugin_setup_values(plugin_id, review_result.setup_values)
            if review_result.setup_summary is not None:
                setup_summary = deepcopy(review_result.setup_summary)
            review_errors = list(review_result.review_errors)

    return {
        "resolved_settings": resolved_settings,
        "setup_values": setup_values,
        "setup_summary": setup_summary,
        "review_errors": review_errors,
    }


def write_plugin_setup_values(
    plugin_id: str,
    *,
    semester_overrides: dict[str, Any] | None = None,
    setup_state: dict[str, Any] | None = None,
    values: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    definition = get_plugin_setup_definition(plugin_id)
    normalized_values = validate_plugin_setup_values(plugin_id, values)
    if definition is None:
        return normalize_setup_state(plugin_id, setup_state), normalize_semester_overrides(plugin_id, semester_overrides), normalized_values

    next_setup_state = normalize_setup_state(plugin_id, setup_state)
    next_semester_overrides = normalize_semester_overrides(plugin_id, semester_overrides)

    for field in definition.fields:
        value = deepcopy(normalized_values[field.path])
        if field.persist in {SETUP_PERSIST_SETUP_STATE, SETUP_PERSIST_BOTH}:
            next_setup_state[field.path] = deepcopy(value)
        if field.persist in {SETUP_PERSIST_SEMESTER_OVERRIDE, SETUP_PERSIST_BOTH}:
            next_semester_overrides[field.path] = deepcopy(value)

    return next_setup_state, next_semester_overrides, normalized_values


def _summary_label_key(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "null"
    return str(value)


def _stringify_setup_summary_value(field: PluginSetupFieldDefinition, value: Any) -> str:
    summary_label_key = _summary_label_key(value)
    if summary_label_key in field.summary_labels:
        return field.summary_labels[summary_label_key]
    if field.field_type == "select":
        option_labels = {str(option["value"]): str(option["label"]) for option in field.options}
        if summary_label_key in option_labels:
            return option_labels[summary_label_key]
    if isinstance(value, bool):
        return "Enabled" if value else "Disabled"
    if value is None:
        return "Not set"
    if isinstance(value, str) and value.strip() == "":
        return "Not set"
    if field.field_type == "json":
        return json.dumps(value, sort_keys=True)
    return str(value)


def build_plugin_setup_summary(
    plugin_id: str,
    *,
    setup_values: dict[str, Any] | None = None,
    semester_overrides: dict[str, Any] | None = None,
    setup_state: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    definition = get_plugin_setup_definition(plugin_id)
    if definition is None:
        return []

    normalized_values = validate_resolved_plugin_setup_values(
        plugin_id,
        setup_values if setup_values is not None else resolve_plugin_setup_values(
            plugin_id,
            semester_overrides=semester_overrides,
            setup_state=setup_state,
        ),
    )

    summary_sections: list[dict[str, Any]] = []
    for section in definition.sections:
        summary_sections.append(
            {
                "id": section.id,
                "title": section.title,
                "description": section.description,
                "items": [
                    {
                        "path": field.path,
                        "label": field.label,
                        "value": _stringify_setup_summary_value(field, normalized_values.get(field.path)),
                    }
                    for field in section.fields
                ],
            }
        )
    return summary_sections


def build_setup_summary(
    plugin_id: str,
    *,
    resolved_settings: dict[str, Any] | None = None,  # Kept for backward compatibility with existing callers.
    setup_state: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    del resolved_settings
    return build_plugin_setup_summary(plugin_id, setup_state=setup_state)
