/**
 * Pure utility functions and module-level constants for the Create Semester Wizard.
 * Nothing in this file renders JSX or accesses React hooks.
 */

import axios from "axios";
import { BookOpen, CheckCircle2, Layers3, Settings2, Sparkles } from "lucide-react";
import type { QueryClient } from "@tanstack/react-query";

import { hydrateSemesterDraftWorkflowCaches } from "@/data/resources";
import type {
  Semester,
  SemesterPluginActivation,
  ProgramPluginInstallation,
  PluginSystemSemesterSetupPlugin,
} from "../../services/api";

import type {
  BasicsDraft,
  PaginationStepToken,
  PersistedStepId,
  PluginSetupDraftMap,
  PluginSetupStepId,
  StepId,
  StepMeta,
  StoredStepId,
} from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

export const REVIEW_COURSE_PREVIEW_LIMIT = 4;
export const PAGINATION_FIXED_STEP_BUTTON_COUNT = 5;

export const STATIC_STEP_ORDER: StepMeta[] = [
  { id: "basics", label: "Basics", icon: Sparkles, detail: "", persistedStep: "basics" },
  { id: "courses", label: "Courses", icon: BookOpen, detail: "Populate the initial draft-owned course set.", persistedStep: "courses" },
  { id: "plugins", label: "Plugins", icon: Layers3, detail: "Choose which Program plugins this Semester can use.", persistedStep: "plugins" },
  { id: "review", label: "Review", icon: CheckCircle2, detail: "Validate every blocker before activation.", persistedStep: "review" },
];

// ─── Step ID helpers ──────────────────────────────────────────────────────────

export const getPluginSetupStepId = (pluginId: string): PluginSetupStepId => `plugin-setup:${pluginId}`;

export const isPluginSetupStepId = (value: string): value is PluginSetupStepId => value.startsWith("plugin-setup:");

export const getPluginIdFromStepId = (step: StepId): string | null => (
  isPluginSetupStepId(step) ? step.slice("plugin-setup:".length) : null
);

export const getPersistedStepId = (step: StoredStepId): PersistedStepId => (
  isPluginSetupStepId(step) ? "plugin-setup" : step
);

// ─── Step order helpers ───────────────────────────────────────────────────────

export const getVisibleStepOrder = (setupPlugins: Array<{ plugin_id: string; display_name: string }>): StepMeta[] => {
  const pluginSetupSteps = setupPlugins.map((plugin) => ({
    id: getPluginSetupStepId(plugin.plugin_id),
    label: plugin.display_name,
    icon: Settings2,
    detail: `Configure ${plugin.display_name} before activation.`,
    persistedStep: "plugin-setup" as const,
    pluginId: plugin.plugin_id,
  }));

  // Destructure to named variables — magic indices are fragile if STATIC_STEP_ORDER ever reorders.
  const [basicsStep, coursesStep, pluginsStep, reviewStep] = STATIC_STEP_ORDER;
  return [basicsStep!, coursesStep!, pluginsStep!, ...pluginSetupSteps, reviewStep!];
};

export const normalizeWizardStep = (step: StoredStepId, setupPlugins: Array<{ plugin_id: string }>): StepId => {
  const fallbackPluginStep = setupPlugins[0] ? getPluginSetupStepId(setupPlugins[0].plugin_id) : "review";
  const isStaticStep = STATIC_STEP_ORDER.some((entry) => entry.id === step);

  if (step === "plugin-setup") {
    return fallbackPluginStep;
  }

  if (isPluginSetupStepId(step)) {
    return setupPlugins.some((plugin) => getPluginSetupStepId(plugin.plugin_id) === step)
      ? step
      : fallbackPluginStep;
  }

  return isStaticStep ? step : "basics";
};

// ─── Pagination ───────────────────────────────────────────────────────────────

export const buildPaginationStepTokens = <TStep extends { id: string; label: string }>(
  steps: TStep[],
  currentIndex: number,
): PaginationStepToken<TStep>[] => {
  if (steps.length === 0) {
    return [];
  }

  if (steps.length <= PAGINATION_FIXED_STEP_BUTTON_COUNT) {
    return steps.map((step, index) => ({ type: "step", step, index }));
  }

  const safeCurrentIndex = Math.min(Math.max(currentIndex, 0), steps.length - 1);
  let orderedIndexes: number[];

  if (safeCurrentIndex <= 2) {
    orderedIndexes = [0, 1, 2, 3, steps.length - 1];
  } else if (safeCurrentIndex >= steps.length - 3) {
    orderedIndexes = [0, steps.length - 4, steps.length - 3, steps.length - 2, steps.length - 1];
  } else {
    orderedIndexes = [0, safeCurrentIndex - 1, safeCurrentIndex, safeCurrentIndex + 1, steps.length - 1];
  }

  const tokens: PaginationStepToken<TStep>[] = [];

  orderedIndexes.forEach((index, orderIndex) => {
    if (orderIndex > 0 && index - orderedIndexes[orderIndex - 1]! > 1) {
      tokens.push({ type: "ellipsis", key: `ellipsis-${orderedIndexes[orderIndex - 1]}-${index}` });
    }
    tokens.push({ type: "step", step: steps[index]!, index });
  });

  return tokens;
};

// ─── Review helpers ───────────────────────────────────────────────────────────

export const buildReviewPreviewText = (items: string[], limit = REVIEW_COURSE_PREVIEW_LIMIT): string => {
  if (items.length === 0) {
    return "";
  }

  const previewItems = items.slice(0, limit);
  if (items.length <= limit) {
    return `${previewItems.join(", ")}.`;
  }

  return `${previewItems.join(", ")}, and ${items.length - limit} more.`;
};

export const getReviewErrorStepLabel = (step: string): string => {
  if (step === "plugin-setup" || step.startsWith("plugin-setup:")) {
    return "Plugin Setup";
  }

  switch (step) {
    case "plugins":
      return "Plugins";
    case "courses":
      return "Courses";
    case "review":
      return "Review";
    case "basics":
      return "Basics";
    default:
      return "Review";
  }
};

export const getPluginReviewValues = (
  plugin: Pick<SemesterPluginActivation, "setup_values">,
  draftValues: Record<string, unknown> | undefined,
): Record<string, unknown> => ({
  ...plugin.setup_values,
  ...draftValues,
});

// ─── Plugin activation helpers ────────────────────────────────────────────────

export const buildSemesterPluginActivation = (
  plugin: ProgramPluginInstallation,
  semesterId: string | undefined,
  isEnabled: boolean,
): SemesterPluginActivation => ({
  id: null,
  semester_id: semesterId ?? "",
  program_plugin_installation_id: plugin.id ?? "",
  plugin_id: plugin.plugin_id,
  display_name: plugin.display_name,
  description: plugin.description,
  author: plugin.author,
  locked: plugin.locked,
  version: plugin.version,
  is_enabled: isEnabled,
  capabilities: plugin.capabilities,
  setup_sections: plugin.setup_sections,
  setup_values: {},
  setup_summary: [],
  review_errors: [],
  available: plugin.available,
  availability_reason: plugin.availability_reason ?? null,
  auth_state: plugin.auth_state,
});

export const syncPluginActivationCollection = (
  activations: SemesterPluginActivation[] | undefined,
  plugin: ProgramPluginInstallation,
  isEnabled: boolean,
  semesterId: string | undefined,
): SemesterPluginActivation[] => {
  const nextActivations = [...(activations ?? [])];
  const index = nextActivations.findIndex((activation) => activation.plugin_id === plugin.plugin_id);

  if (index >= 0) {
    nextActivations[index] = {
      ...nextActivations[index],
      is_enabled: isEnabled,
      locked: plugin.locked,
      setup_sections: plugin.setup_sections,
      capabilities: plugin.capabilities,
      version: plugin.version,
      available: plugin.available,
      availability_reason: plugin.availability_reason ?? null,
      auth_state: plugin.auth_state,
    };
    return nextActivations;
  }

  if (!isEnabled) {
    return nextActivations;
  }

  nextActivations.push(buildSemesterPluginActivation(plugin, semesterId, true));
  return nextActivations;
};

export const syncSemesterPluginToggle = (
  semester: Semester | undefined,
  plugin: ProgramPluginInstallation,
  isEnabled: boolean,
): Semester | undefined => {
  if (!semester) {
    return semester;
  }

  return {
    ...semester,
    creation_step: "plugins",
    plugin_activations: syncPluginActivationCollection(semester.plugin_activations, plugin, isEnabled, semester.id),
  };
};

export const buildSetupStepPlugin = (
  plugin: SemesterPluginActivation,
  setupPayload: PluginSystemSemesterSetupPlugin | undefined,
): PluginSystemSemesterSetupPlugin => ({
  plugin_id: plugin.plugin_id,
  display_name: plugin.display_name,
  description: plugin.description,
  long_description: plugin.long_description,
  author: plugin.author,
  is_enabled: plugin.is_enabled,
  available: plugin.available,
  availability_reason: plugin.availability_reason ?? null,
  setup_sections: setupPayload?.setup_sections ?? plugin.setup_sections,
  setup_values: { ...(setupPayload?.setup_values ?? plugin.setup_values) },
  setup_summary: setupPayload?.setup_summary ?? plugin.setup_summary ?? [],
  review_errors: setupPayload?.review_errors ?? plugin.review_errors ?? [],
});

export const contributesSemesterSetup = ({
  activationSetupSections,
  pluginSystemSetupSections,
}: {
  activationSetupSections: { length: number };
  pluginSystemSetupSections?: { length: number } | null;
}) => activationSetupSections.length > 0 || Boolean(pluginSystemSetupSections && pluginSystemSetupSections.length > 0);

// ─── Draft / cache helpers ────────────────────────────────────────────────────

export const applyDraftPayloadToWizardCaches = (
  queryClient: QueryClient,
  programId: string,
  draft: Semester,
) => {
  hydrateSemesterDraftWorkflowCaches(queryClient, { programId, draft });
};

export const mergeSemesterDraftPayload = (
  previous: Semester | undefined | null,
  next: Semester | null | undefined,
): Semester | null | undefined => {
  if (!next) {
    return next;
  }
  if (!previous) {
    return next;
  }
  return {
    ...previous,
    ...next,
    plugin_activations: next.plugin_activations ?? previous.plugin_activations,
    review_errors: next.review_errors ?? previous.review_errors,
    review_ready: next.review_ready ?? previous.review_ready,
    courses: next.courses ?? previous.courses,
  };
};

// ─── Basics equality ──────────────────────────────────────────────────────────

export const areBasicsEqual = (left: BasicsDraft, right: BasicsDraft) => (
  left.name === right.name
  && left.start_date === right.start_date
  && left.end_date === right.end_date
  && left.reading_week_start === right.reading_week_start
  && left.reading_week_end === right.reading_week_end
);

export const arePluginSetupDraftsEqual = (left: PluginSetupDraftMap, right: PluginSetupDraftMap): boolean => {
  const leftPluginIds = Object.keys(left);
  const rightPluginIds = Object.keys(right);
  if (leftPluginIds.length !== rightPluginIds.length) {
    return false;
  }

  return leftPluginIds.every((pluginId) => {
    if (!Object.prototype.hasOwnProperty.call(right, pluginId)) {
      return false;
    }
    const leftValues = left[pluginId] ?? {};
    const rightValues = right[pluginId] ?? {};
    const leftFieldPaths = Object.keys(leftValues);
    const rightFieldPaths = Object.keys(rightValues);
    if (leftFieldPaths.length !== rightFieldPaths.length) {
      return false;
    }
    return leftFieldPaths.every((fieldPath) => rightValues[fieldPath] === leftValues[fieldPath]);
  });
};

// ─── Misc helpers ─────────────────────────────────────────────────────────────

export const makeInitialBasics = (): BasicsDraft => ({
  name: "",
  start_date: "",
  end_date: "",
  reading_week_start: "",
  reading_week_end: "",
});

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
};

export const isSemesterDraftExistsError = (error: unknown): boolean => {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) {
    return false;
  }

  const detail = error.response?.data?.detail;
  if (!detail || typeof detail !== "object") {
    return false;
  }

  return (detail as { code?: unknown }).code === "SEMESTER_DRAFT_EXISTS";
};
