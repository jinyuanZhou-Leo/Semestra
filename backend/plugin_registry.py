# input:  [Program model records, generated plugin manifest JSON files, plugin registry payloads, and platform-level availability requirements]
# output: [generated-manifest-backed plugin catalog helpers for Program installs, Semester activation, setup definitions, builtin-only setup review hooks, settings validation, setup summaries, and resolved-config computation with tab/widget context metadata]
# pos:    [Backend plugin registry for Program-managed plugin lifecycle and Semester-scoped activation rules plus generated descriptor validation, host-policy overlays, tab/widget context lookups, and plugin-owned setup review dispatch against raw setup values]
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
VALID_SETUP_FIELD_TYPES = {
    "text",
    "textarea",
    "number",
    "boolean",
    "select",
    "date",
    "json",
}
VALID_PLUGIN_KINDS = {"host-shell", "builtin", "external"}
VALID_PLUGIN_VISIBILITIES = {"public", "hidden"}

LEGACY_PLUGIN_ID_ALIASES = {
    "builtin-settings": "builtin-setting",
}


class PluginRegistryValidationError(Exception):
    def __init__(self, code: str, message: str, field_path: str | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.field_path = field_path


def _raise_manifest_error(message: str) -> None:
    raise RuntimeError(f"[plugin-governance] {message}")


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
    validation_rules: tuple[dict[str, Any], ...] = ()


@dataclass(frozen=True)
class PluginMetadata:
    kind: str
    visibility: str
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
    setup_values: dict[str, Any]
    program: Any = None
    semester: Any = None


@dataclass(frozen=True)
class PluginSetupReviewResult:
    review_errors: tuple[PluginSetupReviewIssue, ...] = ()
    setup_summary: list[dict[str, Any]] | None = None
    setup_values: dict[str, Any] | None = None


PluginSetupReviewCallback = Callable[[PluginSetupReviewContext], PluginSetupReviewResult | None]


@dataclass(frozen=True)
class PluginRegistryDefinition:
    plugin_id: str
    default_version: str = "workspace"
    default_settings: dict[str, Any] = field(default_factory=dict)
    fields: tuple[PluginFieldDefinition, ...] = ()
    setup_review: PluginSetupReviewCallback | None = None


@dataclass(frozen=True)
class PluginDefinition:
    plugin_id: str
    metadata: PluginMetadata
    default_version: str = "workspace"
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
    def kind(self) -> str:
        return self.metadata.kind

    @property
    def visibility(self) -> str:
        return self.metadata.visibility

    @property
    def default_installed(self) -> bool:
        return self.kind == "host-shell"

    @property
    def default_enabled(self) -> bool:
        return self.kind == "host-shell"

    @property
    def locked(self) -> bool:
        return self.kind == "host-shell"

    @property
    def requires_authorization(self) -> bool:
        return False

    @property
    def requires_program_lms_integration(self) -> bool:
        return False


PLUGIN_REGISTRY_OVERRIDES: dict[str, PluginRegistryDefinition] = {}


def _plugin_authoring_root() -> Path:
    return Path(__file__).resolve().parent.parent / "frontend" / "src" / "plugins"


def _plugin_manifest_root() -> Path:
    return Path(__file__).resolve().parent / "generated" / "plugin-manifests"


def _setup_schema_path(directory_name: str) -> Path:
    return _plugin_manifest_root() / f"{directory_name}.setup.schema.json"


def _host_policy_path() -> Path:
    return _plugin_authoring_root() / "host-policy.json"


def _load_json_file(path: Path, *, label: str) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - startup failure path
        _raise_manifest_error(f"Failed to parse {label} at '{path}': {exc}.")


def _load_host_policy() -> dict[str, dict[str, str]]:
    path = _host_policy_path()
    if not path.exists():
        return {}
    raw_value = _load_json_file(path, label="plugin host policy")
    if not isinstance(raw_value, dict):
        _raise_manifest_error(f"Plugin host policy '{path}' must be a JSON object.")

    host_policy: dict[str, dict[str, str]] = {}
    for plugin_id, raw_policy in raw_value.items():
        if not isinstance(plugin_id, str) or not plugin_id.strip():
            _raise_manifest_error("Plugin host policy uses an empty plugin id.")
        if not isinstance(raw_policy, dict):
            _raise_manifest_error(f"Plugin host policy for '{plugin_id}' must be an object.")
        kind = str(raw_policy.get("kind") or "").strip()
        visibility = str(raw_policy.get("visibility") or "").strip()
        if kind not in VALID_PLUGIN_KINDS:
            _raise_manifest_error(f"Plugin host policy for '{plugin_id}' uses unsupported kind '{kind}'.")
        if visibility not in VALID_PLUGIN_VISIBILITIES:
            _raise_manifest_error(f"Plugin host policy for '{plugin_id}' uses unsupported visibility '{visibility}'.")
        host_policy[plugin_id] = {
            "kind": kind,
            "visibility": visibility,
        }
    return host_policy


HOST_POLICY_BY_PLUGIN_ID = _load_host_policy()


def _load_plugin_descriptors() -> list[dict[str, Any]]:
    root = _plugin_manifest_root()
    if not root.exists():
        _raise_manifest_error(
            f"Missing generated plugin descriptor root at '{root}'. "
            "Run `npm --prefix frontend run generate-plugin-manifests` before starting the backend."
        )

    descriptors: list[dict[str, Any]] = []
    for descriptor_path in sorted(root.glob("*.plugin.json")):
        raw_value = _load_json_file(descriptor_path, label="plugin descriptor")
        if not isinstance(raw_value, dict):
            _raise_manifest_error(f"Plugin descriptor '{descriptor_path}' must be a JSON object.")
        raw_value["_directory_name"] = str(raw_value.get("id") or "").strip()
        descriptors.append(raw_value)
    if not descriptors:
        _raise_manifest_error(
            f"No generated plugin descriptors were found in '{root}'. "
            "Run `npm --prefix frontend run generate-plugin-manifests` before starting the backend."
        )
    return descriptors


def _load_manifest_string_list(
    plugin_id: str,
    field_name: str,
    raw_value: Any,
) -> list[str]:
    if not isinstance(raw_value, list):
        _raise_manifest_error(f"Plugin descriptor '{plugin_id}' field '{field_name}' must be a JSON array.")
    normalized_values: list[str] = []
    seen_values: set[str] = set()
    for raw_item in raw_value:
        if not isinstance(raw_item, str) or not raw_item.strip():
            _raise_manifest_error(
                f"Plugin descriptor '{plugin_id}' field '{field_name}' must contain non-empty strings."
            )
        if raw_item in seen_values:
            _raise_manifest_error(
                f"Plugin descriptor '{plugin_id}' field '{field_name}' repeats value '{raw_item}'."
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
            f"Plugin descriptor '{plugin_id}' field '{field_name}' must be an object."
        )
    normalized_map: dict[str, list[str]] = {}
    for raw_key, raw_contexts in raw_value.items():
        if not isinstance(raw_key, str) or not raw_key.strip():
            _raise_manifest_error(
                f"Plugin descriptor '{plugin_id}' field '{field_name}' must use non-empty string keys."
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
            f"Plugin descriptor '{plugin_id}' field '{field_name}' does not match declared contribution types: {', '.join(detail_parts)}."
        )
    return normalized_map


def _load_plugin_capabilities(plugin_id: str, raw_entry: dict[str, Any]) -> dict[str, Any]:
    raw_tabs = raw_entry.get("tabs") or []
    raw_widgets = raw_entry.get("widgets") or []
    raw_settings = raw_entry.get("settings") or {}
    if not isinstance(raw_settings, dict):
        _raise_manifest_error(f"Plugin descriptor '{plugin_id}' field 'settings' must be an object.")
    raw_settings_schema = raw_settings.get("schema") or []
    raw_settings_panels = raw_settings.get("panels") or []
    if not isinstance(raw_tabs, list):
        _raise_manifest_error(f"Plugin descriptor '{plugin_id}' field 'tabs' must be a JSON array.")
    if not isinstance(raw_widgets, list):
        _raise_manifest_error(f"Plugin descriptor '{plugin_id}' field 'widgets' must be a JSON array.")
    if not isinstance(raw_settings_schema, list):
        _raise_manifest_error(f"Plugin descriptor '{plugin_id}' field 'settings.schema' must be a JSON array.")
    if not isinstance(raw_settings_panels, list):
        _raise_manifest_error(f"Plugin descriptor '{plugin_id}' field 'settings.panels' must be a JSON array.")

    contexts: set[str] = set()
    available_tab_types: list[str] = []
    available_widget_types: list[str] = []
    tab_allowed_contexts: dict[str, list[str]] = {}
    widget_allowed_contexts: dict[str, list[str]] = {}

    for raw_tab in raw_tabs:
        if not isinstance(raw_tab, dict):
            _raise_manifest_error(f"Plugin descriptor '{plugin_id}' tab definition must be an object.")
        tab_type = raw_tab.get("type")
        if not isinstance(tab_type, str) or not tab_type.strip():
            _raise_manifest_error(f"Plugin descriptor '{plugin_id}' has a tab definition with an empty type.")
        tab_contexts = _load_manifest_string_list(plugin_id, f"tabs.{tab_type}.contexts", raw_tab.get("contexts"))
        available_tab_types.append(tab_type)
        tab_allowed_contexts[tab_type] = tab_contexts
        contexts.update(tab_contexts)

    for raw_widget in raw_widgets:
        if not isinstance(raw_widget, dict):
            _raise_manifest_error(f"Plugin descriptor '{plugin_id}' widget definition must be an object.")
        widget_type = raw_widget.get("type")
        if not isinstance(widget_type, str) or not widget_type.strip():
            _raise_manifest_error(f"Plugin descriptor '{plugin_id}' has a widget definition with an empty type.")
        widget_contexts = _load_manifest_string_list(plugin_id, f"widgets.{widget_type}.contexts", raw_widget.get("contexts"))
        available_widget_types.append(widget_type)
        widget_allowed_contexts[widget_type] = widget_contexts
        contexts.update(widget_contexts)

    for raw_settings_section in raw_settings_panels:
        if not isinstance(raw_settings_section, dict):
            _raise_manifest_error(f"Plugin descriptor '{plugin_id}' settings section must be an object.")
        contexts.update(_load_manifest_string_list(plugin_id, "settings.panels.contexts", raw_settings_section.get("contexts")))

    directory_name = raw_entry.get("_directory_name")
    has_setup_schema = isinstance(directory_name, str) and _setup_schema_path(directory_name).exists()
    host_policy = HOST_POLICY_BY_PLUGIN_ID.get(plugin_id) or {}
    kind = host_policy.get("kind", "external")

    return {
        "contexts": sorted(contexts),
        "available_tab_types": available_tab_types,
        "available_widget_types": available_widget_types,
        "tab_allowed_contexts": tab_allowed_contexts,
        "widget_allowed_contexts": widget_allowed_contexts,
        "has_settings": bool(raw_settings_schema) or bool(raw_settings_panels) or has_setup_schema,
        "supports_unassigned_course": (
            "course" in contexts
            and kind != "host-shell"
            and not has_setup_schema
        ),
    }


def _load_plugin_metadata() -> dict[str, PluginMetadata]:
    raw_manifest = _load_plugin_descriptors()
    metadata_by_plugin_id: dict[str, PluginMetadata] = {}

    for raw_entry in raw_manifest:
        plugin_id = raw_entry.get("id")
        display_name = raw_entry.get("display_name")
        description = raw_entry.get("description")
        long_description = raw_entry.get("long_description")
        author = raw_entry.get("author")

        if not isinstance(plugin_id, str) or not plugin_id.strip():
            _raise_manifest_error("Plugin descriptor is missing id.")
        if not isinstance(display_name, str) or not display_name.strip():
            _raise_manifest_error(f"Plugin descriptor '{plugin_id}' is missing display_name.")
        if not isinstance(description, str) or not description.strip():
            _raise_manifest_error(f"Plugin descriptor '{plugin_id}' is missing description.")
        if not isinstance(long_description, str) or not long_description.strip():
            _raise_manifest_error(f"Plugin descriptor '{plugin_id}' is missing long_description.")
        if not isinstance(author, str) or not author.strip():
            _raise_manifest_error(f"Plugin descriptor '{plugin_id}' is missing author.")
        if plugin_id in metadata_by_plugin_id:
            _raise_manifest_error(f"Plugin descriptor repeats id '{plugin_id}'.")
        host_policy = HOST_POLICY_BY_PLUGIN_ID.get(plugin_id) or {}
        metadata_by_plugin_id[plugin_id] = PluginMetadata(
            kind=str(host_policy.get("kind") or "external"),
            visibility=str(host_policy.get("visibility") or "public"),
            display_name=display_name,
            description=description,
            long_description=long_description,
            author=author,
            capabilities=_load_plugin_capabilities(plugin_id, raw_entry),
        )

    unknown_host_policy_ids = sorted(set(HOST_POLICY_BY_PLUGIN_ID.keys()) - set(metadata_by_plugin_id.keys()))
    if unknown_host_policy_ids:
        _raise_manifest_error(
            f"Plugin host policy references unknown plugin ids: {', '.join(unknown_host_policy_ids)}."
        )

    return metadata_by_plugin_id


PLUGIN_METADATA = _load_plugin_metadata()


def _load_descriptor_registry_definitions() -> dict[str, PluginRegistryDefinition]:
    registry_definitions: dict[str, PluginRegistryDefinition] = {}
    for raw_entry in _load_plugin_descriptors():
        plugin_id = raw_entry.get("id")
        raw_settings = raw_entry.get("settings") or {}
        raw_fields = raw_settings.get("schema") if isinstance(raw_settings, dict) else None
        if not isinstance(plugin_id, str) or not plugin_id.strip():
            _raise_manifest_error("Plugin descriptor is missing id.")
        if not isinstance(raw_settings, dict):
            _raise_manifest_error(f"Plugin descriptor '{plugin_id}' field 'settings' must be an object.")
        if raw_fields is None:
            raw_fields = []
        if not isinstance(raw_fields, list):
            _raise_manifest_error(f"Plugin descriptor '{plugin_id}' field 'settings.schema' must be a JSON array.")

        fields: list[PluginFieldDefinition] = []
        for raw_field in raw_fields:
            if not isinstance(raw_field, dict):
                _raise_manifest_error(f"Plugin descriptor '{plugin_id}' field definition must be an object.")
            field_path = raw_field.get("path")
            field_label = raw_field.get("label")
            field_type = raw_field.get("type")
            scope = raw_field.get("scope")
            raw_options = raw_field.get("options") or []
            if not isinstance(field_path, str) or not field_path.strip():
                _raise_manifest_error(f"Plugin descriptor '{plugin_id}' has a field with an empty path.")
            if not isinstance(field_label, str) or not field_label.strip():
                _raise_manifest_error(f"Plugin descriptor '{plugin_id}' field '{field_path}' is missing label.")
            if field_type not in VALID_SETUP_FIELD_TYPES:
                _raise_manifest_error(f"Plugin descriptor '{plugin_id}' field '{field_path}' uses unsupported type '{field_type}'.")
            if scope not in {FIELD_SCOPE_PROGRAM_ONLY, FIELD_SCOPE_SEMESTER_OVERRIDE}:
                _raise_manifest_error(f"Plugin descriptor '{plugin_id}' field '{field_path}' uses unsupported scope '{scope}'.")
            if not isinstance(raw_options, list):
                _raise_manifest_error(f"Plugin descriptor '{plugin_id}' field '{field_path}' options must be a JSON array.")
            fields.append(
                PluginFieldDefinition(
                    path=field_path,
                    label=field_label,
                    field_type=field_type,
                    scope=scope,
                    default=deepcopy(raw_field.get("default")),
                    description=str(raw_field.get("description") or ""),
                    options=tuple(
                        {
                            "label": str(raw_option.get("label")),
                            "value": str(raw_option.get("value")),
                        }
                        for raw_option in raw_options
                        if isinstance(raw_option, dict)
                    ),
                )
            )

        registry_definitions[plugin_id] = PluginRegistryDefinition(
            plugin_id=plugin_id,
            default_settings=deepcopy(raw_settings.get("defaults") or {}),
            fields=tuple(fields),
        )

    return registry_definitions


DESCRIPTOR_REGISTRY_DEFINITIONS = _load_descriptor_registry_definitions()


def _merge_registry_definitions() -> dict[str, PluginRegistryDefinition]:
    merged_definitions: dict[str, PluginRegistryDefinition] = {}
    for plugin_id, descriptor_definition in DESCRIPTOR_REGISTRY_DEFINITIONS.items():
        metadata = PLUGIN_METADATA.get(plugin_id)
        if metadata is None:
            _raise_manifest_error(f"Plugin descriptor metadata is missing id '{plugin_id}'.")
        host_override = HOST_REGISTRY_OVERRIDES.get(plugin_id)
        if host_override is not None and host_override.setup_review is not None and metadata.kind == "external":
            _raise_manifest_error(
                f"Plugin descriptor '{plugin_id}' is external and cannot declare a host-only setup_review hook."
            )

        merged_definitions[plugin_id] = PluginRegistryDefinition(
            plugin_id=plugin_id,
            default_version=host_override.default_version if host_override is not None else descriptor_definition.default_version,
            default_settings=deepcopy(descriptor_definition.default_settings),
            fields=descriptor_definition.fields,
            setup_review=host_override.setup_review if host_override is not None else None,
        )
    return merged_definitions


def _build_plugin_definitions(
    registry_definitions: dict[str, PluginRegistryDefinition],
    metadata_by_plugin_id: dict[str, PluginMetadata],
) -> dict[str, PluginDefinition]:
    runtime_definitions: dict[str, PluginDefinition] = {}
    all_plugin_ids = sorted(set(registry_definitions.keys()) | set(metadata_by_plugin_id.keys()))

    for plugin_id in all_plugin_ids:
        registry_definition = registry_definitions.get(plugin_id)
        metadata = metadata_by_plugin_id.get(plugin_id)
        if metadata is None:
            _raise_manifest_error(f"Plugin descriptor metadata is missing id '{plugin_id}'.")

        runtime_definitions[plugin_id] = PluginDefinition(
            plugin_id=plugin_id,
            metadata=metadata,
            default_version=registry_definition.default_version if registry_definition is not None else "workspace",
            capabilities=deepcopy(metadata.capabilities),
            default_settings=deepcopy(registry_definition.default_settings) if registry_definition is not None else {},
            fields=registry_definition.fields if registry_definition is not None else (),
            setup_review=registry_definition.setup_review if registry_definition is not None else None,
        )

    return runtime_definitions


HOST_REGISTRY_OVERRIDES = PLUGIN_REGISTRY_OVERRIDES
MERGED_REGISTRY_DEFINITIONS = _merge_registry_definitions()

PLUGIN_DEFINITIONS = _build_plugin_definitions(MERGED_REGISTRY_DEFINITIONS, PLUGIN_METADATA)
HOST_RESERVED_PLUGIN_IDS = {
    plugin_id
    for plugin_id, definition in PLUGIN_DEFINITIONS.items()
    if definition.kind == "host-shell"
}
HOST_RESERVED_TAB_TYPES = {
    tab_type
    for plugin_id, definition in PLUGIN_DEFINITIONS.items()
    if definition.kind == "host-shell"
    for tab_type in definition.capabilities.get("available_tab_types", [])
}
TAB_TYPE_TO_PLUGIN_ID = {
    tab_type: plugin_id
    for plugin_id, definition in PLUGIN_DEFINITIONS.items()
    for tab_type in definition.capabilities.get("available_tab_types", [])
}
WIDGET_TYPE_TO_PLUGIN_ID = {
    widget_type: plugin_id
    for plugin_id, definition in PLUGIN_DEFINITIONS.items()
    for widget_type in definition.capabilities.get("available_widget_types", [])
}

def _load_manifest_field(
    plugin_id: str,
    raw_field: dict[str, Any],
) -> PluginSetupFieldDefinition:
    path = raw_field.get("path")
    label = raw_field.get("label")
    field_type = raw_field.get("type")
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
        required=required,
        default=default_value,
        description=str(description),
        placeholder=str(placeholder),
        options=tuple(options),
        summary_labels=summary_labels,
    )


def _load_plugin_setup_definitions() -> dict[str, PluginSetupDefinition]:
    definitions: dict[str, PluginSetupDefinition] = {}

    for raw_entry in _load_plugin_descriptors():
        plugin_id = raw_entry.get("id")
        directory_name = raw_entry.get("_directory_name")
        if not isinstance(plugin_id, str) or not plugin_id.strip():
            _raise_manifest_error("Plugin descriptor is missing id.")
        if not isinstance(directory_name, str) or not directory_name.strip():
            _raise_manifest_error(f"Plugin descriptor '{plugin_id}' is missing its directory binding.")

        schema_path = _setup_schema_path(directory_name)
        if not schema_path.exists():
            continue

        schema_value = _load_json_file(schema_path, label="plugin setup schema")
        if not isinstance(schema_value, dict):
            _raise_manifest_error(f"Plugin setup schema '{schema_path}' must be a JSON object.")

        raw_sections = schema_value.get("sections") or []
        raw_validation_rules = schema_value.get("validation_rules") or []
        if plugin_id not in PLUGIN_DEFINITIONS:
            _raise_manifest_error(f"Plugin setup schema references unknown plugin_id '{plugin_id}'.")
        if plugin_id in definitions:
            _raise_manifest_error(f"Plugin setup schema repeats plugin_id '{plugin_id}'.")
        if not isinstance(raw_sections, list):
            _raise_manifest_error(f"Plugin setup schema '{plugin_id}' has non-array sections.")
        if not isinstance(raw_validation_rules, list):
            _raise_manifest_error(f"Plugin setup schema '{plugin_id}' has non-array validation_rules.")

        field_order: list[str] = []
        field_map: dict[str, PluginSetupFieldDefinition] = {}

        sections: list[PluginSetupSectionDefinition] = []
        section_ids: set[str] = set()
        for raw_section in raw_sections:
            if not isinstance(raw_section, dict):
                _raise_manifest_error(f"Plugin setup schema '{plugin_id}' contains a non-object section.")
            section_id = raw_section.get("id")
            section_title = raw_section.get("title")
            section_description = raw_section.get("description") or ""
            section_fields = raw_section.get("fields") or []
            if not isinstance(section_id, str) or not section_id.strip():
                _raise_manifest_error(f"Plugin setup schema '{plugin_id}' has a section with an empty id.")
            if section_id in section_ids:
                _raise_manifest_error(f"Plugin setup schema '{plugin_id}' repeats section id '{section_id}'.")
            section_ids.add(section_id)
            if not isinstance(section_title, str) or not section_title.strip():
                _raise_manifest_error(f"Plugin setup schema '{plugin_id}' section '{section_id}' has an empty title.")
            if not isinstance(section_fields, list) or not section_fields:
                _raise_manifest_error(f"Plugin setup schema '{plugin_id}' section '{section_id}' must declare fields.")

            normalized_section_fields: list[PluginSetupFieldDefinition] = []
            section_paths: set[str] = set()
            for raw_section_field in section_fields:
                if not isinstance(raw_section_field, dict):
                    _raise_manifest_error(
                        f"Plugin setup schema '{plugin_id}' section '{section_id}' contains a non-object field."
                    )
                field_path = raw_section_field.get("path")
                if not isinstance(field_path, str) or not field_path.strip():
                    _raise_manifest_error(f"Plugin setup schema '{plugin_id}' section '{section_id}' has an empty field path.")
                if field_path in section_paths:
                    _raise_manifest_error(
                        f"Plugin setup schema '{plugin_id}' section '{section_id}' repeats field '{field_path}'."
                    )
                section_paths.add(field_path)

                section_field_definition = _load_manifest_field(plugin_id, raw_section_field)
                existing_field = field_map.get(field_path)
                if existing_field is None:
                    field_map[field_path] = section_field_definition
                    field_order.append(field_path)
                elif section_field_definition != existing_field:
                    _raise_manifest_error(f"Plugin setup schema '{plugin_id}' field '{field_path}' diverges across sections.")
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
            validation_rules=tuple(
                deepcopy(rule)
                for rule in raw_validation_rules
                if isinstance(rule, dict)
            ),
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
        if definition.default_installed
    ]


def get_default_semester_plugin_ids() -> list[str]:
    return [
        definition.plugin_id
        for definition in list_plugin_definitions()
        if definition.default_enabled
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
        raise PluginRegistryValidationError(error_code, f"{field_label} must be a boolean.")

    if field_type == "select":
        normalized_value = str(value)
        option_values = {str(option["value"]) for option in options}
        if normalized_value not in option_values:
            allowed_values = ", ".join(sorted(option_values))
            raise PluginRegistryValidationError(
                error_code,
                f"{field_label} must be one of: {allowed_values}.",
            )
        return normalized_value

    if field_type == "number":
        if value is None:
            return None
        if isinstance(value, bool):
            raise PluginRegistryValidationError(error_code, f"{field_label} must be a number.")
        if isinstance(value, (int, float)):
            return value
        if isinstance(value, str):
            stripped_value = value.strip()
            if not stripped_value:
                return None
            try:
                parsed_value = float(stripped_value)
            except ValueError as exc:
                raise PluginRegistryValidationError(error_code, f"{field_label} must be a number.") from exc
            if parsed_value.is_integer() and "." not in stripped_value and "e" not in stripped_value.lower():
                return int(parsed_value)
            return parsed_value
        raise PluginRegistryValidationError(error_code, f"{field_label} must be a number.")

    if field_type == "date":
        if value is None:
            return ""
        normalized_value = str(value).strip()
        if not normalized_value:
            return ""
        try:
            date.fromisoformat(normalized_value)
        except ValueError as exc:
            raise PluginRegistryValidationError(error_code, f"{field_label} must use YYYY-MM-DD format.") from exc
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
                raise PluginRegistryValidationError(error_code, f"{field_label} must be valid JSON.") from exc
        try:
            json.dumps(value)
        except TypeError as exc:
            raise PluginRegistryValidationError(error_code, f"{field_label} must be valid JSON.") from exc
        return deepcopy(value)

    if value is None:
        return ""
    return str(value)


def normalize_program_settings(plugin_id: str, payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    if not isinstance(payload, dict):
        raise PluginRegistryValidationError("PROGRAM_PLUGIN_SETTINGS_INVALID", "program_settings must be a JSON object.")
    field_map = _field_map(plugin_id)
    unknown_keys = sorted(set(payload.keys()) - set(field_map.keys()))
    if unknown_keys:
        raise PluginRegistryValidationError(
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
        raise PluginRegistryValidationError("SEMESTER_PLUGIN_OVERRIDES_INVALID", "semester_overrides must be a JSON object.")
    field_map = _field_map(plugin_id)
    unknown_keys = sorted(set(payload.keys()) - set(field_map.keys()))
    if unknown_keys:
        raise PluginRegistryValidationError(
            "SEMESTER_PLUGIN_OVERRIDES_INVALID",
            f"Unknown Semester override keys for {plugin_id}: {', '.join(unknown_keys)}",
        )
    disallowed = sorted(
        key
        for key, value in payload.items()
        if value is not None and field_map[key].scope != FIELD_SCOPE_SEMESTER_OVERRIDE
    )
    if disallowed:
        raise PluginRegistryValidationError(
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


def normalize_setup_values(plugin_id: str, payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    if not isinstance(payload, dict):
        raise PluginRegistryValidationError("SEMESTER_PLUGIN_SETUP_INVALID", "setup_values must be a JSON object.")
    setup_field_map = _setup_field_map(plugin_id)
    unknown_keys = sorted(set(payload.keys()) - set(setup_field_map.keys()))
    if unknown_keys:
        raise PluginRegistryValidationError(
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
    except PluginRegistryValidationError as exc:
        raise PluginRegistryValidationError(exc.code, exc.message, field_path=field.path) from exc


def _apply_plugin_setup_validation_rules(definition: PluginSetupDefinition, normalized_values: dict[str, Any]) -> None:
    for raw_rule in definition.validation_rules:
        rule_type = raw_rule.get("type")
        field_path = raw_rule.get("field")
        message = raw_rule.get("message")
        if not isinstance(field_path, str) or not field_path.strip() or not isinstance(message, str) or not message.strip():
            _raise_manifest_error(f"Plugin setup validation rule in '{definition.plugin_id}' must declare non-empty field and message.")

        value = normalized_values.get(field_path)
        if rule_type == "json-array-min-length":
            min_length = raw_rule.get("min_length")
            if not isinstance(min_length, int) or min_length < 0:
                _raise_manifest_error(f"Plugin setup validation rule '{definition.plugin_id}:{field_path}' has invalid min_length.")
            if not isinstance(value, list) or len(value) < min_length:
                raise PluginRegistryValidationError("PLUGIN_SYSTEM_SETUP_INVALID", message, field_path=field_path)
            continue

        if rule_type == "json-array-unique-keys":
            keys = raw_rule.get("keys")
            if not isinstance(keys, list) or not keys or not all(isinstance(item, str) and item.strip() for item in keys):
                _raise_manifest_error(f"Plugin setup validation rule '{definition.plugin_id}:{field_path}' has invalid keys.")
            if not isinstance(value, list):
                raise PluginRegistryValidationError("PLUGIN_SYSTEM_SETUP_INVALID", message, field_path=field_path)
            for key in keys:
                seen_values: set[str] = set()
                for item in value:
                    if not isinstance(item, dict):
                        raise PluginRegistryValidationError("PLUGIN_SYSTEM_SETUP_INVALID", message, field_path=field_path)
                    normalized_item_value = str(item.get(key, "")).strip().upper()
                    if not normalized_item_value:
                        raise PluginRegistryValidationError("PLUGIN_SYSTEM_SETUP_INVALID", message, field_path=field_path)
                    if normalized_item_value in seen_values:
                        raise PluginRegistryValidationError("PLUGIN_SYSTEM_SETUP_INVALID", message, field_path=field_path)
                    seen_values.add(normalized_item_value)
            continue

        _raise_manifest_error(f"Plugin setup validation rule '{definition.plugin_id}:{field_path}' uses unsupported type '{rule_type}'.")


def _validate_plugin_setup_values(
    plugin_id: str,
    values: dict[str, Any] | None,
    *,
    require_explicit_required_fields: bool,
) -> dict[str, Any]:
    definition = get_plugin_setup_definition(plugin_id)
    if definition is None:
        if values:
            raise PluginRegistryValidationError(
                "PLUGIN_SYSTEM_SETUP_DEFINITION_NOT_FOUND",
                f"Plugin '{plugin_id}' does not declare setup fields.",
            )
        return {}
    if not isinstance(values, dict):
        raise PluginRegistryValidationError("PLUGIN_SYSTEM_SETUP_INVALID", "values must be a JSON object.")

    field_map = _setup_field_map(plugin_id)
    unknown_keys = sorted(set(values.keys()) - set(field_map.keys()))
    if unknown_keys:
        raise PluginRegistryValidationError(
            "PLUGIN_SYSTEM_SETUP_UNKNOWN_FIELD",
            f"Unknown plugin setup keys for {plugin_id}: {', '.join(unknown_keys)}",
        )

    normalized_values: dict[str, Any] = {}
    for field in definition.fields:
        has_explicit_value = field.path in values
        raw_value = values[field.path] if has_explicit_value else deepcopy(field.default)
        if require_explicit_required_fields and field.required and not has_explicit_value:
            raise PluginRegistryValidationError(
                "PLUGIN_SYSTEM_SETUP_REQUIRED",
                f"{field.label} is required.",
                field_path=field.path,
            )
        normalized_value = _normalize_plugin_setup_value(field, raw_value)
        if field.required and _is_missing_setup_value(field, normalized_value):
            raise PluginRegistryValidationError(
                "PLUGIN_SYSTEM_SETUP_REQUIRED",
                f"{field.label} is required.",
                field_path=field.path,
            )
        normalized_values[field.path] = deepcopy(normalized_value)

    _apply_plugin_setup_validation_rules(definition, normalized_values)
    return normalized_values


def resolve_plugin_setup_values(
    plugin_id: str,
    *,
    setup_values: dict[str, Any] | None = None,
) -> dict[str, Any]:
    definition = get_plugin_setup_definition(plugin_id)
    if definition is None:
        return {}

    normalized_setup_values = normalize_setup_values(plugin_id, setup_values)
    resolved_values: dict[str, Any] = {}

    for field in definition.fields:
        if field.path not in normalized_setup_values or normalized_setup_values[field.path] is None:
            resolved_values[field.path] = deepcopy(field.default)
            continue
        resolved_values[field.path] = deepcopy(normalized_setup_values[field.path])

    return resolved_values


def validate_plugin_setup_values(plugin_id: str, values: dict[str, Any] | None) -> dict[str, Any]:
    return _validate_plugin_setup_values(plugin_id, values, require_explicit_required_fields=True)


def validate_resolved_plugin_setup_values(plugin_id: str, values: dict[str, Any] | None) -> dict[str, Any]:
    return _validate_plugin_setup_values(plugin_id, values, require_explicit_required_fields=False)


def review_plugin_setup(
    plugin_id: str,
    *,
    program_settings: dict[str, Any] | None = None,
    setup_values: dict[str, Any] | None = None,
    program: Any = None,
    semester: Any = None,
) -> dict[str, Any]:
    normalized_program_settings = normalize_program_settings(plugin_id, program_settings)
    normalized_setup_values = normalize_setup_values(plugin_id, setup_values)
    setup_values = validate_resolved_plugin_setup_values(
        plugin_id,
        resolve_plugin_setup_values(
            plugin_id,
            setup_values=normalized_setup_values,
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
            setup_values=deepcopy(setup_values),
            program=program,
            semester=semester,
        )
        review_result = definition.setup_review(review_context)
        if review_result is not None:
            if review_result.setup_values is not None:
                setup_values = validate_resolved_plugin_setup_values(plugin_id, review_result.setup_values)
            if review_result.setup_summary is not None:
                setup_summary = deepcopy(review_result.setup_summary)
            review_errors = list(review_result.review_errors)

    return {
        "setup_values": setup_values,
        "setup_summary": setup_summary,
        "review_errors": review_errors,
    }


def write_plugin_setup_values(
    plugin_id: str,
    *,
    values: dict[str, Any] | None = None,
) -> dict[str, Any]:
    definition = get_plugin_setup_definition(plugin_id)
    normalized_values = validate_plugin_setup_values(plugin_id, values)
    if definition is None:
        return normalize_setup_values(plugin_id, values)
    return normalized_values


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
) -> list[dict[str, Any]]:
    definition = get_plugin_setup_definition(plugin_id)
    if definition is None:
        return []

    normalized_values = validate_resolved_plugin_setup_values(
        plugin_id,
        setup_values if setup_values is not None else resolve_plugin_setup_values(plugin_id, setup_values=None),
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
    setup_values: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    return build_plugin_setup_summary(plugin_id, setup_values=setup_values)
