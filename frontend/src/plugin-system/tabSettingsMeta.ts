// input:  [tab-setting source payloads from API responses and current settings scope contracts]
// output: [tab-setting metadata types plus small helper formatters for layer-aware settings UI]
// pos:    [shared tab-settings metadata helpers used by runtime settings pages and Program-level tab-defaults sections]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


export type SettingLayer = 'default' | 'program' | 'semester' | 'course';

export interface SettingSource {
  effective_layer: SettingLayer;
  is_overridden_in_scope: boolean;
  fallback_layer?: SettingLayer | null;
}

export interface TabSettingsMeta {
  scopeSettings: Record<string, unknown>;
  inheritedSettings: Record<string, unknown>;
  settingSources: Record<string, SettingSource>;
}

const LAYER_LABELS: Record<SettingLayer, string> = {
  default: 'Default',
  program: 'Program',
  semester: 'Semester',
  course: 'Course',
};

export const getDefaultSettingSource = (): SettingSource => ({
  effective_layer: 'default',
  is_overridden_in_scope: false,
  fallback_layer: null,
});

export const getSettingSource = (
  meta: TabSettingsMeta | undefined,
  key: string,
): SettingSource => meta?.settingSources[key] ?? getDefaultSettingSource();

export const getSettingLayerLabel = (layer: SettingLayer | null | undefined): string => {
  if (!layer) {
    return 'Default';
  }
  return LAYER_LABELS[layer] ?? 'Default';
};

export const getSettingSourceLabel = (source: SettingSource): string => {
  if (source.effective_layer === 'default') {
    return 'Default';
  }
  return `From ${getSettingLayerLabel(source.effective_layer)}`;
};

export const getSettingResetLabel = (source: SettingSource): string => {
  if (!source.is_overridden_in_scope) {
    return 'Restore default';
  }
  if (!source.fallback_layer || source.fallback_layer === 'default') {
    return 'Restore default';
  }
  return `Use ${getSettingLayerLabel(source.fallback_layer)} setting`;
};
