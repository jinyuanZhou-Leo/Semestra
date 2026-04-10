import type { ComponentType } from "react";

import type { SemesterDraftStep } from "../../services/api";
import type { SemesterBasicsValue } from "../../components/SemesterBasicsFields";

// ─── Step ID flavors ──────────────────────────────────────────────────────────

/** Step ID as stored on the server (via `Semester.creation_step`). */
export type PersistedStepId = SemesterDraftStep;

/** Fixed, always-present wizard steps. */
export type StaticStepId = "basics" | "courses" | "plugins" | "review";

/** Dynamic per-plugin setup step; format: `plugin-setup:<pluginId>`. */
export type PluginSetupStepId = `plugin-setup:${string}`;

/** Union of every step ID that can be active in the UI. */
export type StepId = StaticStepId | PluginSetupStepId;

/**
 * Step ID as it may be stored locally — either a proper `StepId` or the
 * `PersistedStepId` `"plugin-setup"` (which requires normalization before use).
 */
export type StoredStepId = StepId | PersistedStepId;

// ─── Data shapes ─────────────────────────────────────────────────────────────

/** Alias kept for semantic clarity inside the wizard. */
export type BasicsDraft = SemesterBasicsValue;

/** Metadata for a single wizard step entry shown in the pagination rail. */
export type StepMeta = {
  id: StepId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  detail: string;
  persistedStep: PersistedStepId;
  pluginId?: string;
};

/** Map of `pluginId → { fieldPath → value }` – pending local edits. */
export type PluginSetupDraftMap = Record<string, Record<string, unknown>>;

// ─── Pagination ───────────────────────────────────────────────────────────────

export type PaginationStepToken<TStep extends { id: string; label: string }> =
  | { type: "step"; step: TStep; index: number }
  | { type: "ellipsis"; key: string };
