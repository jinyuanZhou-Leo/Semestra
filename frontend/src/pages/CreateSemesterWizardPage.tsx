// input:  [program route params, Program/Semester governance APIs including plugin-system setup routes, axios-backed draft-conflict inspection, app-side Program/Semester resource queries plus draft cache helpers, plugin-manifest icon helpers, existing course CRUD APIs, query cache, shadcn form/layout primitives, motion helpers, plugin setup definitions/validation helpers, and shared data-table row-actions dropdown helpers]
// output: [`CreateSemesterWizardPage` route component with animated step-scoped header/content render blocks, draft-resume-safe create-or-update basics persistence, per-plugin setup wizard steps, guarded initial draft loading plus explicit unavailable-state handling, guarded server-to-local draft hydration, custom-or-DSL plugin setup validation, setup-step visibility sourced from activation-plus-plugin-system payloads, setup-step saves, custom setup context wiring for draft-semester APIs, finalize-safe draft teardown, blank-by-default semester dates for new local drafts, a unified Program-exit confirmation dialog, merged review-status/blocker rendering, tighter review-summary typography/layout, overflow-safe condensed wizard pagination for large step counts, and animated compact bottom navigation labels]
// pos:    [Standalone Semester creation host that owns the draft lifecycle, step navigation, a Semester-settings-aligned shadcn basics step, synchronized smooth header/content step transitions, per-plugin setup orchestration, host-validated plugin setup review handoff, guarded initial loading so local edits do not race draft hydration, refetch-safe local draft state, duplicate-free plugin setup shells, activation-plus-plugin-system-aware setup-step visibility and review summaries, display-name-aware review blockers, unified Program-exit choices, and polished bottom action transitions]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Layers3, Plus, Settings2, Sparkles, Trash2 } from "lucide-react";

import { programKeys, semesterKeys } from "@/data/keys";
import {
  getProgramDetailQueryOptions,
  getProgramSemesterDraftQueryOptions,
  getSemesterDetailQueryOptions,
  getSemesterPluginSystemSetupQueryOptions,
  hydrateSemesterDraftWorkflowCaches,
  invalidateSemesterDraftWorkflowQueries,
  removeSemesterDraftWorkflowQueries,
} from "@/data/resources";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FieldSet } from "@/components/ui/field";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getPluginIconById, getPluginSetupDefinitionById, validatePluginSetupDefinition, type PluginSetupValidationIssue } from "@/plugin-system";

import { AppEmptyState } from "../components/AppEmptyState";
import { Container } from "../components/Container";
import { CourseManagerModal } from "../components/CourseManagerModal";
import { DataTable, DataTableActionMenu } from "../components/DataTable";
import { IconCircle } from "../components/IconCircle";
import { PluginSetupReviewRenderer, PluginSetupStepRenderer } from "../components/PluginSetupRenderers";
import { Layout } from "../components/Layout";
import {
  getSemesterBasicsValidation,
  SemesterBasicsFields,
  type SemesterBasicsValue,
} from "../components/SemesterBasicsFields";
import { isAutoSaveError, useAutoSave } from "../hooks/useAutoSave";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { reportError } from "../services/appStatus";
import api, {
  type Course,
  type PluginSystemSemesterSetupPlugin,
  type ProgramPluginInstallation,
  type Semester,
  type SemesterDraftStep,
  type SemesterPluginActivation,
} from "../services/api";
import { formatGpaPercentage } from "../utils/percentage";

type PersistedStepId = SemesterDraftStep;
type StaticStepId = "basics" | "courses" | "plugins" | "review";
type PluginSetupStepId = `plugin-setup:${string}`;
type StepId = StaticStepId | PluginSetupStepId;
type StoredStepId = StepId | PersistedStepId;

type BasicsDraft = SemesterBasicsValue;
type StepMeta = {
  id: StepId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  detail: string;
  persistedStep: PersistedStepId;
  pluginId?: string;
};

type PluginSetupDraftMap = Record<string, Record<string, unknown>>;

const getPluginSetupStepId = (pluginId: string): PluginSetupStepId => `plugin-setup:${pluginId}`;

const isPluginSetupStepId = (value: string): value is PluginSetupStepId => value.startsWith("plugin-setup:");

const getPluginIdFromStepId = (step: StepId): string | null => (
  isPluginSetupStepId(step) ? step.slice("plugin-setup:".length) : null
);

const getPersistedStepId = (step: StoredStepId): PersistedStepId => (
  isPluginSetupStepId(step) ? "plugin-setup" : step
);

const getPluginReviewValues = (
  plugin: Pick<SemesterPluginActivation, "setup_values">,
  draftValues: Record<string, unknown> | undefined,
): Record<string, unknown> => ({
  ...(plugin.setup_values ?? {}),
  ...(draftValues ?? {}),
});

const areBasicsEqual = (left: BasicsDraft, right: BasicsDraft) => (
  left.name === right.name
  && left.start_date === right.start_date
  && left.end_date === right.end_date
  && left.reading_week_start === right.reading_week_start
  && left.reading_week_end === right.reading_week_end
);

const arePluginSetupDraftsEqual = (left: PluginSetupDraftMap, right: PluginSetupDraftMap) => {
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

const STATIC_STEP_ORDER: StepMeta[] = [
  { id: "basics", label: "Basics", icon: Sparkles, detail: "", persistedStep: "basics" },
  { id: "courses", label: "Courses", icon: BookOpen, detail: "Populate the initial draft-owned course set.", persistedStep: "courses" },
  { id: "plugins", label: "Plugins", icon: Layers3, detail: "Choose which Program plugins this Semester can use.", persistedStep: "plugins" },
  { id: "review", label: "Review", icon: CheckCircle2, detail: "Validate every blocker before activation.", persistedStep: "review" },
];
const REVIEW_COURSE_PREVIEW_LIMIT = 4;
const PAGINATION_FIXED_STEP_BUTTON_COUNT = 5;

type PaginationStepToken<TStep extends { id: string; label: string }> =
  | { type: "step"; step: TStep; index: number }
  | { type: "ellipsis"; key: string };

const buildReviewPreviewText = (items: string[], limit = REVIEW_COURSE_PREVIEW_LIMIT) => {
  if (items.length === 0) {
    return "";
  }

  const previewItems = items.slice(0, limit);
  if (items.length <= limit) {
    return `${previewItems.join(", ")}.`;
  }

  return `${previewItems.join(", ")}, and ${items.length - limit} more.`;
};

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

const contributesSemesterSetup = ({
  activationSetupSections,
  pluginSystemSetupSections,
}: {
  activationSetupSections: { length: number };
  pluginSystemSetupSections?: { length: number } | null;
}) => activationSetupSections.length > 0 || Boolean(pluginSystemSetupSections && pluginSystemSetupSections.length > 0);

const getVisibleStepOrder = (setupPlugins: Array<{ plugin_id: string; display_name: string }>): StepMeta[] => {
  const pluginSetupSteps = setupPlugins.map((plugin) => ({
    id: getPluginSetupStepId(plugin.plugin_id),
    label: plugin.display_name,
    icon: Settings2,
    detail: `Configure ${plugin.display_name} before activation.`,
    persistedStep: "plugin-setup" as const,
    pluginId: plugin.plugin_id,
  }));

  return [
    STATIC_STEP_ORDER[0],
    STATIC_STEP_ORDER[1],
    STATIC_STEP_ORDER[2],
    ...pluginSetupSteps,
    STATIC_STEP_ORDER[3],
  ];
};

const normalizeWizardStep = (step: StoredStepId, setupPlugins: Array<{ plugin_id: string }>): StepId => {
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

const buildSemesterPluginActivation = (
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

const syncPluginActivationCollection = (
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

const syncSemesterPluginToggle = (
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

const buildSetupStepPlugin = (
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
  setup_values: { ...(setupPayload?.setup_values ?? plugin.setup_values ?? {}) },
  setup_summary: setupPayload?.setup_summary ?? plugin.setup_summary ?? [],
  review_errors: setupPayload?.review_errors ?? plugin.review_errors ?? [],
});

const applyDraftPayloadToWizardCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  programId: string,
  draft: Semester,
) => {
  hydrateSemesterDraftWorkflowCaches(queryClient, { programId, draft });
};

const mergeSemesterDraftPayload = (
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

const getReviewErrorStepLabel = (step: string): string => {
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

const makeInitialBasics = (): BasicsDraft => ({
  name: "",
  start_date: "",
  end_date: "",
  reading_week_start: "",
  reading_week_end: "",
});

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
};

const isSemesterDraftExistsError = (error: unknown): boolean => {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) {
    return false;
  }

  const detail = error.response?.data?.detail;
  if (!detail || typeof detail !== "object") {
    return false;
  }

  return (detail as { code?: unknown }).code === "SEMESTER_DRAFT_EXISTS";
};

export const CreateSemesterWizardPage: React.FC = () => {
  const { id: programId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [currentStep, setCurrentStep] = useState<StoredStepId>("basics");
  const [stepDirection, setStepDirection] = useState(1);
  const [basics, setBasics] = useState<BasicsDraft>(makeInitialBasics);
  const [isCourseManagerOpen, setIsCourseManagerOpen] = useState(false);
  const [pendingRemoveCourse, setPendingRemoveCourse] = useState<Course | null>(null);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isUpdatingPluginSelection, setIsUpdatingPluginSelection] = useState(false);
  const [isRemovingCourse, setIsRemovingCourse] = useState(false);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [pluginSetupDrafts, setPluginSetupDrafts] = useState<PluginSetupDraftMap>({});
  const [pluginSetupValidationErrors, setPluginSetupValidationErrors] = useState<Record<string, PluginSetupValidationIssue[]>>({});
  const [savedBasics, setSavedBasics] = useState<BasicsDraft>(makeInitialBasics);
  const [savedPluginSetupDrafts, setSavedPluginSetupDrafts] = useState<PluginSetupDraftMap>({});
  const basicsFlushRef = useRef<() => Promise<void>>(async () => {});
  const pluginSetupFlushRef = useRef<() => Promise<void>>(async () => {});
  const hydratedBasicsDraftIdRef = useRef<string | null>(null);
  const hydratedPluginSetupDraftIdRef = useRef<string | null>(null);

  const programQuery = useQuery({
    ...getProgramDetailQueryOptions(programId ?? "missing"),
    enabled: Boolean(programId),
    staleTime: 60_000,
  });

  const currentDraftQuery = useQuery({
    ...getProgramSemesterDraftQueryOptions(programId ?? "missing"),
    enabled: Boolean(programId) && !isFinalizing,
    staleTime: 10_000,
  });

  const draftId = currentDraftQuery.data?.id;
  const semesterDetailQuery = useQuery({
    ...getSemesterDetailQueryOptions(draftId ?? "missing"),
    enabled: Boolean(draftId) && !isFinalizing,
    staleTime: 10_000,
  });
  const pluginSystemSetupQuery = useQuery({
    ...getSemesterPluginSystemSetupQueryOptions(draftId ?? "missing"),
    enabled: Boolean(draftId) && !isFinalizing,
    staleTime: 10_000,
  });

  const pluginCatalog = useMemo(
    () => (programQuery.data?.plugin_installations ?? []).filter((plugin) => plugin.installed && plugin.is_enabled),
    [programQuery.data?.plugin_installations],
  );
  const pluginActivations = useMemo(
    () => semesterDetailQuery.data?.plugin_activations ?? currentDraftQuery.data?.plugin_activations ?? [],
    [currentDraftQuery.data?.plugin_activations, semesterDetailQuery.data?.plugin_activations],
  );
  const enabledPlugins = useMemo(
    () => pluginActivations.filter((plugin) => plugin.is_enabled),
    [pluginActivations],
  );
  const enabledPluginIds = useMemo(
    () => new Set(enabledPlugins.map((plugin) => plugin.plugin_id)),
    [enabledPlugins],
  );
  const pluginSystemSetupById = useMemo(
    () => new Map((pluginSystemSetupQuery.data?.plugins ?? []).map((plugin) => [plugin.plugin_id, plugin])),
    [pluginSystemSetupQuery.data?.plugins],
  );
  const serverBasics = useMemo<BasicsDraft | null>(() => {
    const draft = currentDraftQuery.data;
    if (!draft) {
      return null;
    }
    return {
      name: draft.name || "",
      start_date: draft.start_date ?? "",
      end_date: draft.end_date ?? "",
      reading_week_start: draft.reading_week_start ?? "",
      reading_week_end: draft.reading_week_end ?? "",
    };
  }, [currentDraftQuery.data]);
  const isBasicsDirty = !areBasicsEqual(basics, savedBasics);
  const isPluginSetupDirty = !arePluginSetupDraftsEqual(pluginSetupDrafts, savedPluginSetupDrafts);
  const setupStepPlugins = useMemo(
    () => enabledPlugins.filter((plugin) => contributesSemesterSetup({
      activationSetupSections: plugin.setup_sections,
      pluginSystemSetupSections: pluginSystemSetupById.get(plugin.plugin_id)?.setup_sections,
    })),
    [enabledPlugins, pluginSystemSetupById],
  );
  const setupPlugins = useMemo(
    () => setupStepPlugins.map((plugin) => buildSetupStepPlugin(plugin, pluginSystemSetupById.get(plugin.plugin_id))),
    [pluginSystemSetupById, setupStepPlugins],
  );
  const serverPluginSetupDrafts = useMemo<PluginSetupDraftMap>(
    () => Object.fromEntries(
      setupPlugins.map((plugin) => [
        plugin.plugin_id,
        { ...plugin.setup_values },
      ]),
    ),
    [setupPlugins],
  );
  useEffect(() => {
    if (!draftId || !serverBasics) {
      hydratedBasicsDraftIdRef.current = null;
      return;
    }
    const isNewDraft = hydratedBasicsDraftIdRef.current !== draftId;
    const serverChanged = !areBasicsEqual(serverBasics, savedBasics);
    if (isNewDraft || (!isBasicsDirty && serverChanged)) {
      setBasics(serverBasics);
      setSavedBasics(serverBasics);
      if (isNewDraft) {
        const persistedStep = currentDraftQuery.data?.creation_step;
        if (persistedStep) {
          setCurrentStep(persistedStep);
        }
      }
      hydratedBasicsDraftIdRef.current = draftId;
    }
  }, [currentDraftQuery.data?.creation_step, draftId, isBasicsDirty, savedBasics, serverBasics]);

  const stepOrder = useMemo(() => getVisibleStepOrder(setupStepPlugins), [setupStepPlugins]);
  const activeStep = normalizeWizardStep(currentStep, setupStepPlugins);
  const currentStepIndex = stepOrder.findIndex((step) => step.id === activeStep);
  const paginationStepTokens = useMemo(
    () => buildPaginationStepTokens(stepOrder, currentStepIndex),
    [currentStepIndex, stepOrder],
  );
  const currentStepMeta = stepOrder[currentStepIndex] ?? stepOrder[0];
  useEffect(() => {
    if (activeStep === currentStep) {
      return;
    }
    const nextIndex = stepOrder.findIndex((step) => step.id === activeStep);
    const previousIndex = stepOrder.findIndex((step) => step.id === normalizeWizardStep(currentStep, setupStepPlugins));
    setStepDirection(nextIndex >= previousIndex ? 1 : -1);
    setCurrentStep(activeStep);
    if (!draftId || !programId) {
      return;
    }
    void api.updateSemesterDraft(draftId, { creation_step: getPersistedStepId(activeStep) })
      .then((result) => {
        queryClient.setQueryData<Semester | null | undefined>(programKeys.semesterDraft(programId), (current) => (
          mergeSemesterDraftPayload(current, result)
        ));
      })
      .catch((error) => {
        console.error("Failed to normalize Semester wizard step", error);
      });
  }, [activeStep, currentStep, draftId, programId, queryClient, setupStepPlugins, stepOrder]);

  useEffect(() => {
    if (!draftId) {
      hydratedPluginSetupDraftIdRef.current = null;
      return;
    }
    const isNewDraft = hydratedPluginSetupDraftIdRef.current !== draftId;
    const serverChanged = !arePluginSetupDraftsEqual(serverPluginSetupDrafts, savedPluginSetupDrafts);
    if (isNewDraft || (!isPluginSetupDirty && serverChanged)) {
      setPluginSetupDrafts(serverPluginSetupDrafts);
      setSavedPluginSetupDrafts(serverPluginSetupDrafts);
      hydratedPluginSetupDraftIdRef.current = draftId;
    }
  }, [draftId, isPluginSetupDirty, savedPluginSetupDrafts, serverPluginSetupDrafts]);

  useEffect(() => {
    setPluginSetupValidationErrors((current) => {
      const nextEntries = Object.entries(current).filter(([pluginId]) => setupPlugins.some((plugin) => plugin.plugin_id === pluginId));
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }
      return Object.fromEntries(nextEntries);
    });
  }, [setupPlugins]);

  const invalidateDraftData = async ({ includeProgramDetail = false }: { includeProgramDetail?: boolean } = {}) => {
    if (!programId) return;
    await invalidateSemesterDraftWorkflowQueries(queryClient, {
      programId,
      draftId,
      includeProgramDetail,
    });
  };

  const persistBasics = async (nextStep?: StepId, snapshot?: BasicsDraft) => {
    if (!programId) return null;
    const draftSnapshot = snapshot ?? basics;
    const payload = {
      name: draftSnapshot.name,
      start_date: draftSnapshot.start_date || undefined,
      end_date: draftSnapshot.end_date || undefined,
      reading_week_start: draftSnapshot.reading_week_start || null,
      reading_week_end: draftSnapshot.reading_week_end || null,
      creation_step: getPersistedStepId(nextStep ?? activeStep),
    };

    if (!draftId) {
      const currentDraft = await api.getCurrentSemesterDraft(programId);
      if (currentDraft?.id) {
        queryClient.setQueryData(programKeys.semesterDraft(programId), currentDraft);
        return api.updateSemesterDraft(currentDraft.id, payload);
      }

      try {
        return await api.createSemesterDraft(programId, payload);
      } catch (error) {
        if (!isSemesterDraftExistsError(error)) {
          throw error;
        }

        const resumedDraft = await api.getCurrentSemesterDraft(programId);
        if (!resumedDraft?.id) {
          throw error;
        }
        queryClient.setQueryData(programKeys.semesterDraft(programId), resumedDraft);
        return api.updateSemesterDraft(resumedDraft.id, payload);
      }
    }
    return api.updateSemesterDraft(draftId, payload);
  };

  const { flush: flushBasics } = useAutoSave({
    value: basics,
    savedValue: savedBasics,
    enabled: Boolean(draftId) && activeStep === "basics",
    debounceMs: 400,
    maxWaitMs: 1500,
    onSave: async (snapshot) => {
      if (!draftId) return;
      const result = await persistBasics(activeStep, snapshot);
      if (result?.id) {
        queryClient.setQueryData(programKeys.semesterDraft(programId!), result);
        setSavedBasics({
          name: result.name || "",
          start_date: result.start_date ?? "",
          end_date: result.end_date ?? "",
          reading_week_start: result.reading_week_start ?? "",
          reading_week_end: result.reading_week_end ?? "",
        });
      }
      await invalidateDraftData();
    },
    onError: () => {
      reportError("Failed to save Semester basics. Please retry.");
    },
  });

  const { flush: flushPluginSetup } = useAutoSave({
    value: pluginSetupDrafts,
    savedValue: savedPluginSetupDrafts,
    enabled: Boolean(draftId) && getPersistedStepId(activeStep) === "plugin-setup",
    debounceMs: 400,
    maxWaitMs: 1500,
    onSave: async (snapshot) => {
      if (!draftId) return;
      await Promise.all(
        setupPlugins.map(async (plugin) => {
          const pluginDraft = snapshot[plugin.plugin_id];
          if (!pluginDraft) return;
          await api.updateSemesterPluginSystemSetup(draftId, plugin.plugin_id, {
            values: pluginDraft,
          });
        }),
      );
      setSavedPluginSetupDrafts(snapshot);
      await invalidateDraftData();
    },
    onError: () => {
      reportError("Failed to save plugin setup. Please retry.");
    },
  });

  useEffect(() => {
    basicsFlushRef.current = flushBasics;
  }, [flushBasics]);

  useEffect(() => {
    pluginSetupFlushRef.current = flushPluginSetup;
  }, [flushPluginSetup]);

  useEffect(() => {
    return () => {
      void basicsFlushRef.current().catch(() => {});
      void pluginSetupFlushRef.current().catch(() => {});
    };
  }, []);

  const flushStepDraftChanges = async (nextStep: StepId) => {
    await basicsFlushRef.current();
    if (getPersistedStepId(activeStep) === "plugin-setup" || nextStep === "review") {
      await pluginSetupFlushRef.current();
    }
  };

  const saveStepTransition = async (nextStep: StepId) => {
    const normalizedNextStep = normalizeWizardStep(nextStep, setupStepPlugins);
    if (!draftId) {
      return persistBasics(normalizedNextStep);
    }
    await flushStepDraftChanges(normalizedNextStep);
    return api.updateSemesterDraft(draftId, { creation_step: getPersistedStepId(normalizedNextStep) });
  };

  const validateActivePluginSetupStep = async () => {
    const pluginId = getPluginIdFromStepId(activeStep);
    if (!pluginId) {
      return true;
    }

    const plugin = setupPlugins.find((entry) => entry.plugin_id === pluginId);
    const definition = getPluginSetupDefinitionById(pluginId);
    if (!plugin || !definition) {
      return true;
    }

    const issues = await validatePluginSetupDefinition(definition, pluginSetupDrafts[pluginId] ?? plugin.setup_values);
    setPluginSetupValidationErrors((current) => ({
      ...current,
      [pluginId]: issues,
    }));
    return issues.length === 0;
  };

  const goToStep = async (step: StepId) => {
    const nextStep = normalizeWizardStep(step, setupStepPlugins);
    const nextIndex = stepOrder.findIndex((item) => item.id === nextStep);
    const currentIndex = stepOrder.findIndex((item) => item.id === activeStep);

    if (nextIndex > currentIndex) {
      const isCurrentPluginStepValid = await validateActivePluginSetupStep();
      if (!isCurrentPluginStepValid) {
        reportError("Resolve the highlighted plugin setup issues before continuing.");
        return;
      }
    }

    setStepDirection(nextIndex >= currentIndex ? 1 : -1);
    setIsSavingStep(true);
    try {
      let result = await saveStepTransition(nextStep);
      if (nextStep === "review" && result?.id) {
        await api.reviewSemesterPluginSystem(result.id);
        result = await api.reviewSemesterDraft(result.id);
      }
      await invalidateDraftData();
      if (result?.id) {
        queryClient.setQueryData<Semester | null | undefined>(programKeys.semesterDraft(programId!), (current) => (
          mergeSemesterDraftPayload(current, result)
        ));
      }
      setCurrentStep(nextStep);
    } catch (error) {
      console.error("Failed to change Semester wizard step", error);
      if (!isAutoSaveError(error)) {
        reportError("Failed to change steps. Please retry.");
      }
    } finally {
      setIsSavingStep(false);
    }
  };

  const handleTogglePlugin = async (plugin: ProgramPluginInstallation, checked: boolean) => {
    if (!draftId || !programId) return;
    const draftQueryKey = programKeys.semesterDraft(programId);
    const semesterDetailQueryKey = semesterKeys.detail(draftId);
    const previousDraft = queryClient.getQueryData<Semester>(draftQueryKey);
    const previousSemester = queryClient.getQueryData<Semester>(semesterDetailQueryKey);

    setIsUpdatingPluginSelection(true);
    setCurrentStep("plugins");
    queryClient.setQueryData<Semester>(draftQueryKey, (current) => syncSemesterPluginToggle(current, plugin, checked));
    queryClient.setQueryData<Semester>(semesterDetailQueryKey, (current) => syncSemesterPluginToggle(current, plugin, checked));
    try {
      await api.upsertSemesterPluginActivation(draftId, plugin.plugin_id, {
        is_enabled: checked,
      });
      await api.updateSemesterDraft(draftId, { creation_step: "plugins" });
      await invalidateDraftData();
    } catch (error) {
      queryClient.setQueryData(draftQueryKey, previousDraft);
      queryClient.setQueryData(semesterDetailQueryKey, previousSemester);
      console.error("Failed to toggle plugin in Semester wizard", error);
      reportError("Failed to update plugin enablement. Please retry.");
    } finally {
      setIsUpdatingPluginSelection(false);
    }
  };

  const handleToggleAllPlugins = async (checked: boolean) => {
    if (!draftId || !programId) return;

    const targets = pluginCatalog.filter((plugin) => {
      if (plugin.locked) {
        return false;
      }
      const isEnabled = enabledPluginIds.has(plugin.plugin_id);
      return checked
        ? plugin.available && !isEnabled
        : isEnabled;
    });

    if (targets.length === 0) {
      return;
    }

    const draftQueryKey = programKeys.semesterDraft(programId);
    const semesterDetailQueryKey = semesterKeys.detail(draftId);
    const previousDraft = queryClient.getQueryData<Semester>(draftQueryKey);
    const previousSemester = queryClient.getQueryData<Semester>(semesterDetailQueryKey);
    const targetPluginIds = targets.map((plugin) => plugin.plugin_id);

    setIsUpdatingPluginSelection(true);
    setCurrentStep("plugins");
    queryClient.setQueryData<Semester>(draftQueryKey, (current) => {
      let nextSemester = current;
      for (const plugin of targets) {
        nextSemester = syncSemesterPluginToggle(nextSemester, plugin, checked);
      }
      return nextSemester;
    });
    queryClient.setQueryData<Semester>(semesterDetailQueryKey, (current) => {
      let nextSemester = current;
      for (const plugin of targets) {
        nextSemester = syncSemesterPluginToggle(nextSemester, plugin, checked);
      }
      return nextSemester;
    });
    try {
      const updatedDraft = await api.bulkUpdateSemesterPluginActivations(draftId, {
        plugin_ids: targetPluginIds,
        is_enabled: checked,
      });
      applyDraftPayloadToWizardCaches(queryClient, programId, updatedDraft);
      await queryClient.invalidateQueries({ queryKey: semesterKeys.pluginSystemSetup(draftId) });
    } catch (error) {
      queryClient.setQueryData(draftQueryKey, previousDraft);
      queryClient.setQueryData(semesterDetailQueryKey, previousSemester);
      console.error("Failed to toggle all plugins in Semester wizard", error);
      reportError("Failed to update plugin enablement. Please retry.");
    } finally {
      setIsUpdatingPluginSelection(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (isRemovingCourse) return;
    setIsRemovingCourse(true);
    try {
      await api.deleteCourse(courseId);
      await invalidateDraftData();
      setPendingRemoveCourse(null);
    } catch (error) {
      console.error("Failed to delete course from Semester draft", error);
      reportError("Failed to delete the course. Please retry.");
    } finally {
      setIsRemovingCourse(false);
    }
  };

  const handleFinalize = async () => {
    if (!draftId) return;
    setIsFinalizing(true);
    try {
      await basicsFlushRef.current();
      await pluginSetupFlushRef.current();
      await api.reviewSemesterPluginSystem(draftId);
      const reviewedDraft = await api.reviewSemesterDraft(draftId);
      queryClient.setQueryData(programKeys.semesterDraft(programId!), reviewedDraft);
      if (!reviewedDraft.review_ready) {
        reportError("Resolve the draft review errors before finalizing.");
        return;
      }
      const result = await api.finalizeSemesterDraft(draftId);
      queryClient.setQueryData(programKeys.semesterDraft(programId!), null);
      removeSemesterDraftWorkflowQueries(queryClient, draftId);
      queryClient.invalidateQueries({ queryKey: programKeys.detail(programId!) }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: programKeys.semesterDraft(programId!) }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: semesterKeys.detail(result.id) }).catch(() => {});
      navigate(`/semesters/${result.id}`);
    } catch (error) {
      console.error("Failed to finalize Semester draft", error);
      if (!isAutoSaveError(error)) {
        reportError("Failed to finalize the Semester. Please retry.");
      }
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (!draftId) {
      navigate(`/programs/${programId}`);
      return;
    }
    try {
      await api.discardSemesterDraft(draftId);
      queryClient.removeQueries({ queryKey: semesterKeys.detail(draftId) });
      removeSemesterDraftWorkflowQueries(queryClient, draftId);
      await invalidateSemesterDraftWorkflowQueries(queryClient, {
        programId: programId!,
        includeProgramDetail: true,
      });
      setIsExitDialogOpen(false);
      navigate(`/programs/${programId}`);
    } catch (error) {
      console.error("Failed to discard Semester draft", error);
      reportError("Failed to discard the draft. Please retry.");
    }
  };

  const handleLeaveWizard = () => {
    setIsExitDialogOpen(false);
    navigate(`/programs/${programId}`);
  };

  const updatePluginSetupField = (plugin: PluginSystemSemesterSetupPlugin, fieldPath: string, value: unknown) => {
    setPluginSetupValidationErrors((current) => {
      if (!current[plugin.plugin_id]) {
        return current;
      }
      const nextErrors = { ...current };
      delete nextErrors[plugin.plugin_id];
      return nextErrors;
    });
    setPluginSetupDrafts((current) => ({
      ...current,
      [plugin.plugin_id]: {
        ...(current[plugin.plugin_id] ?? plugin.setup_values),
        [fieldPath]: value,
      },
    }));
  };

  const breadcrumb = (
    <Breadcrumb>
      <BreadcrumbList className="text-xs font-medium text-muted-foreground">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">Academics</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {programQuery.data ? (
            <BreadcrumbLink asChild>
              <Link to={`/programs/${programQuery.data.id}`}>{programQuery.data.name}</Link>
            </BreadcrumbLink>
          ) : (
            <span>Program</span>
          )}
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Create Semester</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  if (!programId) {
    return (
      <Layout breadcrumb={breadcrumb}>
        <Container>
          <AppEmptyState scenario="not-found" size="page" title="Program not found" description="No Program ID was provided in the route." />
        </Container>
      </Layout>
    );
  }

  const isInitialWizardLoading = programQuery.isLoading
    || currentDraftQuery.isLoading
    || (Boolean(draftId) && (semesterDetailQuery.isLoading || pluginSystemSetupQuery.isLoading));

  if (isInitialWizardLoading) {
    return (
      <Layout breadcrumb={breadcrumb}>
        <Container className="flex h-[calc(100svh-60px)] flex-col gap-6 overflow-hidden pt-6 pb-0">
          <section className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden">
              <div className="flex flex-col gap-4">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-px w-full" />
              </div>
              <div className="flex flex-col gap-4">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
              <div className="mt-auto flex gap-4">
                <Skeleton className="h-10 flex-1 rounded-xl sm:max-w-44" />
                <Skeleton className="h-10 flex-1 rounded-xl sm:ml-auto sm:max-w-44" />
              </div>
            </div>
          </section>
        </Container>
      </Layout>
    );
  }

  const wizardLoadError = programQuery.error
    ?? currentDraftQuery.error
    ?? semesterDetailQuery.error
    ?? pluginSystemSetupQuery.error;

  if (wizardLoadError) {
    return (
      <Layout breadcrumb={breadcrumb}>
        <Container>
          <AppEmptyState
            scenario="unavailable"
            size="page"
            title="Semester setup is unavailable"
            description={getErrorMessage(wizardLoadError, "The wizard data could not be loaded. Please retry.")}
            primaryAction={(
              <Button
                type="button"
                onClick={() => {
                  void programQuery.refetch();
                  void currentDraftQuery.refetch();
                  if (draftId) {
                    void semesterDetailQuery.refetch();
                    void pluginSystemSetupQuery.refetch();
                  }
                }}
              >
                Retry
              </Button>
            )}
          />
        </Container>
      </Layout>
    );
  }

  if (!programQuery.isLoading && !programQuery.data) {
    return (
      <Layout breadcrumb={breadcrumb}>
        <Container>
          <AppEmptyState scenario="not-found" size="page" title="Program not found" description="The Program you are trying to configure does not exist." />
        </Container>
      </Layout>
    );
  }

  const courseList = semesterDetailQuery.data?.courses ?? [];
  const reviewErrors = Array.from(
    new Map(
      [...(currentDraftQuery.data?.review_errors ?? []), ...(semesterDetailQuery.data?.review_errors ?? [])]
        .map((error) => [
          `${error.step}:${error.code}:${error.plugin_id ?? "platform"}:${error.field_path ?? "detail"}:${error.message}`,
          error,
        ]),
    ).values(),
  );
  const reviewReady = reviewErrors.length === 0 && Boolean(
    currentDraftQuery.data?.review_ready
    || semesterDetailQuery.data?.review_ready,
  );
  const blockedEnabledPlugins = enabledPlugins.filter((plugin) => !plugin.available);
  const hasBlockedEnabledPlugins = blockedEnabledPlugins.length > 0;
  const courseCount = courseList.length;
  const enabledPluginCount = enabledPlugins.length;
  const blockedPluginCount = enabledPlugins.filter((plugin) => !plugin.available).length;
  const courseReviewSummary = courseCount === 0
    ? "No draft courses yet."
    : buildReviewPreviewText(courseList.map((course) => course.name));
  const pluginReviewSummary = enabledPluginCount === 0
    ? "No plugins enabled for this Semester."
    : buildReviewPreviewText(enabledPlugins.map((plugin) => (
      plugin.available ? plugin.display_name : `${plugin.display_name} (blocked)`
    )));
  const reviewSummaryPlugins = setupPlugins.filter((plugin) => (
    (plugin.setup_summary ?? []).length > 0
    || Boolean(getPluginSetupDefinitionById(plugin.plugin_id)?.ui?.reviewComponent)
  ));
  const pluginDisplayNameById = new Map(
    [...pluginCatalog, ...enabledPlugins, ...setupPlugins]
      .map((plugin) => [plugin.plugin_id, plugin.display_name] as const),
  );
  const reviewDateRangeValue = basics.start_date && basics.end_date
    ? `${basics.start_date} to ${basics.end_date}`
    : "Start and end dates are not set yet.";
  const reviewReadingWeekValue = basics.reading_week_start && basics.reading_week_end
    ? `${basics.reading_week_start} to ${basics.reading_week_end}`
    : "No reading week configured.";
  const courseReviewMeta = courseCount === 1 ? "1 course" : `${courseCount} courses`;
  const pluginReviewMeta = blockedPluginCount > 0
    ? `${enabledPluginCount} enabled, ${blockedPluginCount} blocked`
    : `${enabledPluginCount} enabled`;
  const canFinalize = Boolean(
    draftId &&
    reviewReady &&
    !hasBlockedEnabledPlugins,
  );
  const StepIcon = currentStepMeta.icon;
  const previousStepId = currentStepIndex > 0 ? stepOrder[currentStepIndex - 1]?.id ?? null : null;
  const previousStepLabel = previousStepId ? stepOrder[currentStepIndex - 1]?.label ?? null : null;
  const nextStepId = currentStepIndex >= 0 && currentStepIndex < stepOrder.length - 1 ? stepOrder[currentStepIndex + 1]?.id ?? null : null;
  const nextStepLabel = nextStepId ? stepOrder[currentStepIndex + 1]?.label ?? null : null;
  const basicsValidation = getSemesterBasicsValidation(basics);
  const isReviewStep = activeStep === "review";
  const isBasicsStep = activeStep === "basics";
  const isBasicsStepInvalid = !basics.name.trim() || !basics.start_date || !basics.end_date || !basicsValidation.isValid;
  const primaryActionLabel = isReviewStep
    ? "Create Semester"
    : nextStepLabel
      ? nextStepLabel
      : "Continue";
  const secondaryActionLabel = isBasicsStep
    ? "Program"
    : previousStepLabel ?? "Back";
  const isPrimaryActionDisabled = isReviewStep
    ? (!canFinalize || isFinalizing)
    : isBasicsStep
      ? (isSavingStep || isBasicsStepInvalid)
      : (isSavingStep || isUpdatingPluginSelection);
  const handlePrimaryAction = () => {
    if (isReviewStep) {
      void handleFinalize();
      return;
    }

    if (nextStepId) {
      void goToStep(nextStepId);
    }
  };

  const basicsStepContent = (
    <FieldSet>
      <SemesterBasicsFields
        value={basics}
        onChange={(nextBasics) => setBasics(nextBasics)}
        showRequiredIndicators
      />
    </FieldSet>
  );

  const coursesStepContent = (
    <DataTable
      title="Semester Courses"
      description="Review the courses assigned to this Semester draft."
      showHeader={false}
      rootClassName="flex h-full min-h-0 flex-col"
      items={courseList}
      actionButton={(
        <Button
          type="button"
          onClick={() => setIsCourseManagerOpen(true)}
          disabled={!draftId}
          className="w-full shrink-0 sm:w-auto sm:self-start"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add / Manage Courses
        </Button>
      )}
      emptyMessage="No courses assigned."
      minWidthClassName="min-w-[34rem] sm:min-w-[42rem]"
      shellClassName="min-h-[18rem] min-w-0 flex-1 overflow-y-auto"
      emptyRowClassName="h-[15rem] align-middle sm:h-full"
      tableClassName="h-full w-full min-w-full sm:w-max sm:min-w-full [&_td]:max-w-[14rem] sm:[&_td]:max-w-[18rem] [&_td]:whitespace-normal sm:[&_td]:whitespace-nowrap [&_th]:max-w-[14rem] sm:[&_th]:max-w-[18rem] [&_th]:whitespace-normal sm:[&_th]:whitespace-nowrap"
      getRowKey={(course) => course.id}
      columns={[
        {
          key: 'name',
          label: 'Name',
          fit: 'fill',
          minWidth: 208,
          cellClassName: 'align-middle font-medium',
          cell: (course) => (
            <div className="flex flex-col gap-1">
              <span className="break-words">{course.name}</span>
              {course.alias ? (
                <span className="break-words text-xs text-muted-foreground">{course.alias}</span>
              ) : null}
            </div>
          ),
        },
        { key: 'credits', label: 'Credits', width: 104, cellClassName: 'align-middle whitespace-nowrap' },
        {
          key: 'grade',
          label: 'Grade',
          width: 112,
          cellClassName: 'align-middle whitespace-nowrap',
          cell: (course) => formatGpaPercentage(course.grade_percentage),
        },
        {
          key: 'actions',
          label: 'Actions',
          width: 56,
          align: 'right',
          cellClassName: 'align-middle',
          cell: (course) => (
            <DataTableActionMenu triggerLabel={`Open actions for ${course.name}`}>
              <DropdownMenuItem variant="destructive" onClick={() => setPendingRemoveCourse(course)}>
                <Trash2 className="h-4 w-4" />
                Remove
              </DropdownMenuItem>
            </DataTableActionMenu>
          ),
        },
      ]}
    />
  );

  const pluginsStepContent = (
    <DataTable
      title="Plugins"
      description="Enable or disable Program plugins for this Semester."
      showHeader={false}
      rootClassName="flex h-full min-h-0 flex-col"
      items={pluginCatalog}
      emptyMessage="This Program does not have any installed plugins available for Semester configuration yet."
      minWidthClassName="min-w-[36rem] sm:min-w-[44rem] xl:min-w-[52rem]"
      shellClassName="min-h-[20rem] min-w-0 flex-1 overflow-y-auto"
      emptyRowClassName="h-[17rem] align-middle sm:h-full"
      tableClassName="h-full w-full min-w-full table-auto sm:w-max sm:min-w-full [&_td]:max-w-[16rem] sm:[&_td]:max-w-[22rem] [&_td]:whitespace-normal sm:[&_td]:whitespace-nowrap [&_th]:max-w-[16rem] sm:[&_th]:max-w-[22rem] [&_th]:whitespace-normal sm:[&_th]:whitespace-nowrap"
      renderHeader={() => (
        <TableRow>
          <TableHead className="min-w-[220px]">Plugin</TableHead>
          <TableHead className="min-w-[120px]">Author</TableHead>
          <TableHead className="w-[180px] text-right">
            <div className="ml-auto flex w-full max-w-[172px] items-center justify-end gap-3">
              <span>Enabled</span>
              <Switch
                checked={pluginCatalog.some((plugin) => !plugin.locked && plugin.available) && pluginCatalog.filter((plugin) => !plugin.locked && plugin.available).every((plugin) => enabledPluginIds.has(plugin.plugin_id))}
                aria-label="Toggle all editable plugins"
                disabled={isUpdatingPluginSelection || !pluginCatalog.some((plugin) => (!plugin.locked && plugin.available) || (!plugin.locked && enabledPluginIds.has(plugin.plugin_id)))}
                onCheckedChange={(checked) => {
                  void handleToggleAllPlugins(Boolean(checked));
                }}
              />
            </div>
          </TableHead>
        </TableRow>
      )}
      renderRow={(plugin) => {
        const pluginIcon = getPluginIconById(plugin.plugin_id);
        const isEnabled = enabledPluginIds.has(plugin.plugin_id);
        const switchDisabled = (!plugin.available && !isEnabled) || plugin.locked;

        return (
          <TableRow key={plugin.plugin_id} className="align-middle">
            <TableCell className="py-3 align-middle">
              <div className="flex items-start gap-3">
                <IconCircle icon={pluginIcon} label={plugin.display_name} size={30} className="bg-muted text-foreground" />
                <div className="min-w-0 space-y-1">
                  <div className="font-medium text-foreground">{plugin.display_name}</div>
                  <p className="text-sm text-muted-foreground">{plugin.description}</p>
                  {plugin.locked ? <p className="text-xs text-muted-foreground">Required by the Program.</p> : null}
                  {!plugin.available ? <p className="text-xs text-amber-700 dark:text-amber-300">{plugin.availability_reason ?? "Not available."}</p> : null}
                </div>
              </div>
            </TableCell>
            <TableCell className="py-3 align-middle">
              <span className="text-sm text-muted-foreground">{plugin.author}</span>
            </TableCell>
            <TableCell className="py-3 text-right align-middle">
              <div className="ml-auto flex w-full max-w-[132px] items-center justify-end gap-3">
                <span className="text-xs text-muted-foreground">{isEnabled ? "On" : "Off"}</span>
                <Switch
                  checked={isEnabled}
                  aria-label={`${plugin.display_name} enabled`}
                  onCheckedChange={(checked) => {
                    void handleTogglePlugin(plugin, Boolean(checked));
                  }}
                  disabled={switchDisabled}
                />
              </div>
            </TableCell>
          </TableRow>
        );
      }}
    />
  );

  const pluginSetupStepContent = (
    <div className="space-y-6">
      {setupPlugins.length === 0 || !isPluginSetupStepId(activeStep) ? (
        <div className="rounded-lg border border-dashed border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
          No enabled plugins require setup.
        </div>
      ) : (
        setupPlugins
          .filter((plugin) => plugin.plugin_id === getPluginIdFromStepId(activeStep))
          .map((plugin) => (
            <section key={plugin.plugin_id}>
              <PluginSetupStepRenderer
                plugin={plugin}
                values={pluginSetupDrafts[plugin.plugin_id] ?? plugin.setup_values}
                localErrors={pluginSetupValidationErrors[plugin.plugin_id] ?? []}
                semesterId={draftId}
                programId={programId}
                onValueChange={(fieldPath, value) => updatePluginSetupField(plugin, fieldPath, value)}
              />
            </section>
          ))
      )}
    </div>
  );

  const reviewStepContent = (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-muted-foreground">Semester</div>
          <div className="text-2xl leading-tight font-semibold tracking-tight text-foreground sm:text-3xl">
            {basics.name || "Untitled Semester"}
          </div>
        </div>

        <dl className="grid gap-y-3 border-t border-border/70 pt-4">
          {[
            {
              label: "Date range",
              value: reviewDateRangeValue,
            },
            {
              label: "Reading week",
              value: reviewReadingWeekValue,
            },
            {
              label: "Courses",
              value: courseReviewMeta,
              detail: courseReviewSummary,
            },
            {
              label: "Plugins",
              value: pluginReviewMeta,
              detail: pluginReviewSummary,
            },
          ].map((item) => (
            <div key={item.label} className="grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-4">
              <dt className="text-sm font-medium text-muted-foreground">{item.label}</dt>
              <div className="min-w-0">
                <dd className="text-sm leading-6 font-medium text-foreground">
                  {item.value}
                </dd>
                {item.detail ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item.detail}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </dl>
      </section>

      {reviewSummaryPlugins.length > 0 ? (
        <div className="space-y-4">
          <div className="text-sm font-medium">Plugin setup summary</div>
          <Accordion type="single" collapsible className="rounded-xl border border-border/70 px-4">
            {reviewSummaryPlugins.map((plugin) => (
              <AccordionItem key={`review:${plugin.plugin_id}`} value={`review:${plugin.plugin_id}`}>
                <AccordionTrigger className="gap-4 py-5 hover:no-underline">
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">{plugin.display_name}</div>
                    <div className="text-sm text-muted-foreground">{plugin.description}</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-1">
                  <PluginSetupReviewRenderer
                    plugin={plugin}
                    values={getPluginReviewValues(plugin, pluginSetupDrafts[plugin.plugin_id])}
                    semesterId={draftId}
                    programId={programId}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ) : null}

      {reviewErrors.length > 0 ? (
        <div className="space-y-3">
          {reviewErrors.map((error) => (
            <Card key={`${error.step}:${error.code}:${error.plugin_id ?? "platform"}:${error.field_path ?? "detail"}`} size="sm" className="border-amber-500/30 shadow-none">
              <CardContent className="space-y-2">
                <div className="font-medium text-foreground">
                  {getReviewErrorStepLabel(error.step)}
                  {error.plugin_id ? ` · ${pluginDisplayNameById.get(error.plugin_id) ?? error.plugin_id}` : ""}
                </div>
                <div className="text-sm text-muted-foreground">{error.message}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {blockedEnabledPlugins.length > 0 ? (
        <div className="space-y-3">
          {blockedEnabledPlugins.map((plugin) => (
            <Card key={`blocked:${plugin.plugin_id}`} size="sm" className="border-amber-500/30 shadow-none">
              <CardContent className="space-y-2">
                <div className="font-medium text-foreground">Plugins · {plugin.display_name}</div>
                <div className="text-sm text-muted-foreground">{plugin.availability_reason ?? "This enabled plugin is still blocked."}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <Layout breadcrumb={breadcrumb}>
      <Container className="flex h-[calc(100svh-60px)] flex-col gap-6 overflow-hidden pt-6 pb-0">
        <section className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <header className="shrink-0 space-y-4">
            <div className="min-w-0 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`wizard-header:${activeStep}`}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: stepDirection > 0 ? 32 : -32 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: stepDirection > 0 ? -24 : 24 }}
                  transition={prefersReducedMotion ? { duration: 0.12 } : { type: "spring", stiffness: 340, damping: 34, mass: 0.78 }}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <StepIcon className="h-6 w-6 shrink-0 text-muted-foreground sm:h-7 sm:w-7" />
                    <h1 className="min-w-0 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">{currentStepMeta.label}</h1>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            <Separator />
          </header>

          <ScrollArea className="min-h-0 flex-1">
            <div className="px-0 pt-4 pb-28 sm:pb-24">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeStep}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: stepDirection > 0 ? 32 : -32 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: stepDirection > 0 ? -24 : 24 }}
                  transition={prefersReducedMotion ? { duration: 0.12 } : { type: "spring", stiffness: 340, damping: 34, mass: 0.78 }}
                  className={cn(
                    "space-y-6 pr-1",
                    activeStep === "courses" || activeStep === "plugins" ? "flex h-full min-h-0 flex-col" : "",
                  )}
                >
              {activeStep === "basics" ? basicsStepContent : null}

              {activeStep === "courses" ? coursesStepContent : null}

              {activeStep === "plugins" ? pluginsStepContent : null}

              {isPluginSetupStepId(activeStep) ? pluginSetupStepContent : null}

              {activeStep === "review" ? reviewStepContent : null}
                </motion.div>
              </AnimatePresence>
            </div>
          </ScrollArea>

          <div className="sticky bottom-0 z-10 shrink-0 border-t border-border/70 bg-background/95 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 backdrop-blur supports-backdrop-filter:bg-background/80">
            <div className="space-y-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4 sm:space-y-0">
              <div className="flex justify-center sm:order-2">
                <Pagination className="mx-auto w-auto">
                  <PaginationContent className="gap-2">
                    {paginationStepTokens.map((token) => {
                      if (token.type === "ellipsis") {
                        return (
                          <PaginationItem key={token.key}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }

                      const { step, index } = token;

                      return (
                        <PaginationItem key={step.id}>
                          <Button
                            type="button"
                            variant={activeStep === step.id ? "outline" : "ghost"}
                            size="icon"
                            aria-current={activeStep === step.id ? "page" : undefined}
                            aria-label={`Step ${index + 1}: ${step.label}`}
                            title={step.label}
                            disabled={index > currentStepIndex}
                            onClick={() => {
                              if (index < currentStepIndex) {
                                void goToStep(step.id);
                              }
                            }}
                            className={cn(
                              "h-8 w-8 rounded-full text-xs",
                              index < currentStepIndex ? "border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : "",
                            )}
                          >
                            {index < currentStepIndex ? <Check className="h-3.5 w-3.5" /> : index + 1}
                          </Button>
                        </PaginationItem>
                      );
                    })}
                  </PaginationContent>
                </Pagination>
              </div>

              <div className="sm:order-1 sm:flex sm:justify-start">
                {previousStepId || isBasicsStep ? (
                  <Button
                    variant={isBasicsStep ? "destructive" : "outline"}
                    disabled={isSavingStep || isUpdatingPluginSelection}
                    onClick={() => {
                      if (isBasicsStep) {
                        setIsExitDialogOpen(true);
                        return;
                      }
                      if (previousStepId) {
                        void goToStep(previousStepId);
                      }
                    }}
                    className="w-full sm:w-44"
                    title={secondaryActionLabel}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={secondaryActionLabel}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        className="flex w-full items-center justify-center"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        <span className="truncate">{secondaryActionLabel}</span>
                      </motion.span>
                    </AnimatePresence>
                  </Button>
                ) : (
                  <div className="hidden sm:block" />
                )}
              </div>

              <div className="sm:order-3 sm:flex sm:justify-end">
                <Button
                  onClick={handlePrimaryAction}
                  disabled={isPrimaryActionDisabled}
                  className="w-full sm:w-44"
                  title={primaryActionLabel}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={primaryActionLabel}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="flex w-full items-center justify-center"
                    >
                      <span className="truncate">{primaryActionLabel}</span>
                      {isReviewStep ? <Check className="ml-2 h-4 w-4" /> : <ArrowRight className="ml-2 h-4 w-4" />}
                    </motion.span>
                  </AnimatePresence>
                </Button>
              </div>
            </div>
          </div>
          </div>
        </section>
      </Container>
      <CourseManagerModal
        isOpen={isCourseManagerOpen}
        onClose={() => setIsCourseManagerOpen(false)}
        programId={programId!}
        semesterId={draftId}
        closeOnSuccess
        onCourseAdded={() => invalidateDraftData()}
      />
      <AlertDialog
        open={pendingRemoveCourse !== null}
        onOpenChange={(open) => {
          if (!open && !isRemovingCourse) {
            setPendingRemoveCourse(null);
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove course from draft?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoveCourse
                ? `${pendingRemoveCourse.name} will be removed from this Semester draft.`
                : "This course will be removed from this Semester draft."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingCourse}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isRemovingCourse || !pendingRemoveCourse}
              onClick={() => {
                if (!pendingRemoveCourse) return;
                void handleDeleteCourse(pendingRemoveCourse.id);
              }}
            >
              {isRemovingCourse ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Semester setup?</AlertDialogTitle>
            <AlertDialogDescription>
              Return to the Program dashboard. Keep preserves any saved draft progress, while Discard removes the draft before leaving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveWizard}>
              Keep
            </AlertDialogAction>
            <AlertDialogAction variant="destructive" onClick={() => void handleDiscardDraft()}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};
