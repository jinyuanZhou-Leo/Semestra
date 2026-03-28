# input:  [backend CRUD submodules for shared helpers, Program/plugin governance, academic entities, and layout persistence]
# output: [thin CRUD facade that re-exports the backend data-access surface while keeping import sites stable]
# pos:    [compatibility-preserving entry module for backend CRUD after splitting the monolith into focused modules]
#
# ⚠️ When this file is updated:
#    1. Update these header comments
#    2. Update the INDEX.md of the folder this file belongs to

from crud_shared import *  # noqa: F401,F403
from crud_layout import *  # noqa: F401,F403
from crud_programs import *  # noqa: F401,F403
from crud_plugin_governance import *  # noqa: F401,F403
from crud_academics import *  # noqa: F401,F403

from crud_layout import _ensure_course_plugin_tabs, _ensure_tab_context, _ensure_plugin_settings_context, _ensure_widget_context, _get_next_tab_order, _normalize_context_tabs
from crud_plugin_governance import _build_semester_review_state, _delete_program_plugin_runtime_data, _ensure_default_program_plugin_installations, _ensure_default_semester_plugin_activations, _normalize_auth_state, _normalize_program_plugin_installations, _refresh_semester_review_ready, _resolve_course_plugin_availability, _resolve_course_plugin_availability_reason, _resolve_program_plugin_availability, _resolve_semester_plugin_availability, _resolve_semester_plugin_availability_reason, _serialize_course_plugin_activation, _serialize_plugin_system_setup_plugin, _serialize_program_plugin_installation, _serialize_semester_plugin_activation, _supports_unassigned_course
from crud_academics import _serialize_semester_draft, _validate_course_semester_assignment
