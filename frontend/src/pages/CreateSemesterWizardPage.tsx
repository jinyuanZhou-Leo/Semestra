// input:  [program route params, Program/Semester governance APIs including plugin-system setup routes, axios-backed draft-conflict inspection, plugin-manifest icon helpers, existing course CRUD APIs, query cache, shadcn form/layout primitives, motion helpers, and shared data-table row-actions dropdown helpers]
// output: [`CreateSemesterWizardPage` route component with animated step-scoped header/content render blocks, draft-resume-safe create-or-update basics persistence, guarded server-to-local draft hydration, setup-aware step normalization, Eventcore-excluded plugin-setup saves, and finalize-safe draft teardown]
// pos:    [Standalone Semester creation host that owns the draft lifecycle, step navigation, a Semester-settings-aligned shadcn basics step, synchronized smooth header/content step transitions, a course-list-settings-aligned courses table with AlertDialog-backed removal confirmation, draft-conflict-safe resume behavior, refetch-safe local draft state, setup-aware plugin orchestration that excludes Eventcore onboarding, finalize-safe review handoff, and a shadcn-style row-actions dropdown for course removal while keeping the file build-clean]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Layers3, Plus, Settings2, Sparkles, Trash2 } from "lucide-react";

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
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getPluginIconById } from "@/plugin-system";
import { queryKeys } from "@/services/queryKeys";

import { AppEmptyState } from "../components/AppEmptyState";
import { Container } from "../components/Container";
import { CourseManagerModal } from "../components/CourseManagerModal";
import { DataTable, DataTableActionMenu } from "../components/DataTable";
import { IconCircle } from "../components/IconCircle";
import { Layout } from "../components/Layout";
import { PluginGovernanceFieldControl } from "../components/PluginGovernanceFieldControl";
import {
  getSemesterBasicsValidation,
  SemesterBasicsFields,
  type SemesterBasicsValue,
} from "../components/SemesterBasicsFields";
import { useAutoSave } from "../hooks/useAutoSave";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { reportError } from "../services/appStatus";
import api, {
  type Course,
  type PluginSystemSemesterSetupPlugin,
  type PluginSystemSemesterSetupResponse,
  type ProgramPluginInstallation,
  type Semester,
  type SemesterDraftStep,
  type SemesterPluginActivation,
} from "../services/api";
import { formatGpaPercentage } from "../utils/percentage";

type StepId = SemesterDraftStep;

type BasicsDraft = SemesterBasicsValue;
type StepMeta = {
  id: StepId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  detail: string;
};

type PluginSetupDraftMap = Record<string, Record<string, unknown>>;

const isStepId = (value: string): value is StepId => value in STEP_META_BY_ID;

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

const STEP_ORDER: StepMeta[] = [
  { id: "basics", label: "Basics", icon: Sparkles, detail: "" },
  { id: "courses", label: "Courses", icon: BookOpen, detail: "Populate the initial draft-owned course set." },
  { id: "plugins", label: "Plugins", icon: Layers3, detail: "Choose which Program plugins this Semester can use." },
  { id: "plugin-setup", label: "Plugin Setup", icon: Settings2, detail: "Resolve host-rendered plugin setup contributions." },
  { id: "review", label: "Review", icon: CheckCircle2, detail: "Validate every blocker before activation." },
];
const STEP_META_BY_ID = Object.fromEntries(STEP_ORDER.map((step) => [step.id, step])) as Record<StepId, StepMeta>;
const STEP_INDEX_BY_ID = Object.fromEntries(STEP_ORDER.map((step, index) => [step.id, index])) as Record<StepId, number>;
const REVIEW_COURSE_PREVIEW_LIMIT = 4;
const SETUP_EXCLUDED_PLUGIN_IDS = new Set(["builtin-event-core"]);

const contributesSemesterSetup = (pluginId: string, setupSections: { length: number }) =>
  setupSections.length > 0 && !SETUP_EXCLUDED_PLUGIN_IDS.has(pluginId);

const getVisibleStepOrder = (hasSetupPlugins: boolean): StepMeta[] =>
  hasSetupPlugins ? STEP_ORDER : STEP_ORDER.filter((step) => step.id !== "plugin-setup");

const normalizeWizardStep = (step: StepId, hasSetupPlugins: boolean): StepId =>
  step === "plugin-setup" && !hasSetupPlugins ? "review" : step;

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
  semester_overrides: {},
  setup_state: {},
  resolved_settings: {},
  fields: plugin.fields,
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
      fields: plugin.fields,
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

const syncPluginSystemSetupResponse = (
  response: PluginSystemSemesterSetupResponse | undefined,
  pluginId: string,
  isEnabled: boolean,
): PluginSystemSemesterSetupResponse | undefined => {
  if (!response) {
    return response;
  }

  return {
    ...response,
    step: "plugins",
    plugins: response.plugins.map((plugin) => (
      plugin.plugin_id === pluginId
        ? { ...plugin, is_enabled: isEnabled }
        : plugin
    )),
  };
};

const getNextStepId = (step: StepId, hasSetupPlugins: boolean): StepId | null => {
  switch (step) {
    case "basics":
      return "courses";
    case "courses":
      return "plugins";
    case "plugins":
      return hasSetupPlugins ? "plugin-setup" : "review";
    case "plugin-setup":
      return "review";
    case "review":
      return null;
  }
};

const getPreviousStepId = (step: StepId, hasSetupPlugins: boolean): StepId | null => {
  switch (step) {
    case "basics":
      return null;
    case "courses":
      return "basics";
    case "plugins":
      return "courses";
    case "plugin-setup":
      return "plugins";
    case "review":
      return hasSetupPlugins ? "plugin-setup" : "plugins";
  }
};

const getReviewErrorStepLabel = (step: string): string => {
  switch (step) {
    case "plugin-setup":
      return "Plugin Setup";
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

const todayIso = () => new Date().toISOString().slice(0, 10);

const addDaysIso = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const makeInitialBasics = (): BasicsDraft => ({
  name: "",
  start_date: todayIso(),
  end_date: addDaysIso(111),
  reading_week_start: "",
  reading_week_end: "",
});

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

  const [currentStep, setCurrentStep] = useState<StepId>("basics");
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
  const [savedBasics, setSavedBasics] = useState<BasicsDraft>(makeInitialBasics);
  const [savedPluginSetupDrafts, setSavedPluginSetupDrafts] = useState<PluginSetupDraftMap>({});
  const basicsFlushRef = useRef<() => Promise<void>>(async () => {});
  const pluginSetupFlushRef = useRef<() => Promise<void>>(async () => {});
  const hydratedBasicsDraftIdRef = useRef<string | null>(null);
  const hydratedPluginSetupDraftIdRef = useRef<string | null>(null);

  const programQuery = useQuery({
    queryKey: programId ? queryKeys.programs.detail(programId) : ["programs", "missing"],
    queryFn: () => api.getProgram(programId!),
    enabled: Boolean(programId),
    staleTime: 60_000,
  });

  const currentDraftQuery = useQuery({
    queryKey: programId ? queryKeys.programs.semesterDraft(programId) : ["draft", "missing"],
    queryFn: () => api.getCurrentSemesterDraft(programId!),
    enabled: Boolean(programId) && !isFinalizing,
    staleTime: 10_000,
  });

  const draftId = currentDraftQuery.data?.id;
  const semesterDetailQuery = useQuery({
    queryKey: draftId ? queryKeys.semesters.detail(draftId) : ["semesters", "draft", "missing"],
    queryFn: () => api.getSemester(draftId!),
    enabled: Boolean(draftId) && !isFinalizing,
    staleTime: 10_000,
  });
  const pluginSystemSetupQuery = useQuery({
    queryKey: draftId ? queryKeys.semesters.pluginSystemSetup(draftId) : ["plugin-system", "draft", "missing"],
    queryFn: () => api.getSemesterPluginSystemSetup(draftId!),
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
  const pluginSystemSetupPlugins = useMemo(
    () => (pluginSystemSetupQuery.data?.plugins ?? []).filter((plugin) => contributesSemesterSetup(plugin.plugin_id, plugin.setup_sections)),
    [pluginSystemSetupQuery.data?.plugins],
  );
  const serverBasics = useMemo<BasicsDraft | null>(() => {
    const draft = currentDraftQuery.data;
    if (!draft) {
      return null;
    }
    return {
      name: draft.name || "",
      start_date: draft.start_date ?? todayIso(),
      end_date: draft.end_date ?? addDaysIso(111),
      reading_week_start: draft.reading_week_start ?? "",
      reading_week_end: draft.reading_week_end ?? "",
    };
  }, [
    currentDraftQuery.data?.end_date,
    currentDraftQuery.data?.name,
    currentDraftQuery.data?.reading_week_end,
    currentDraftQuery.data?.reading_week_start,
    currentDraftQuery.data?.start_date,
  ]);
  const serverPluginSetupDrafts = useMemo<PluginSetupDraftMap>(
    () => Object.fromEntries(
      pluginSystemSetupPlugins.map((plugin) => [
        plugin.plugin_id,
        { ...plugin.setup_values },
      ]),
    ),
    [pluginSystemSetupPlugins],
  );
  const isBasicsDirty = !areBasicsEqual(basics, savedBasics);
  const isPluginSetupDirty = !arePluginSetupDraftsEqual(pluginSetupDrafts, savedPluginSetupDrafts);
  const setupPluginIds = useMemo(
    () => enabledPlugins.filter((plugin) => contributesSemesterSetup(plugin.plugin_id, plugin.setup_sections)).map((plugin) => plugin.plugin_id),
    [enabledPlugins],
  );
  const setupPlugins = useMemo(
    () => pluginSystemSetupPlugins.filter(
      (plugin) => contributesSemesterSetup(plugin.plugin_id, plugin.setup_sections) && setupPluginIds.includes(plugin.plugin_id),
    ),
    [pluginSystemSetupPlugins, setupPluginIds],
  );
  const hasSetupPlugins = setupPluginIds.length > 0;

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
        if (persistedStep && isStepId(persistedStep)) {
          setCurrentStep(persistedStep);
        }
      }
      hydratedBasicsDraftIdRef.current = draftId;
    }
  }, [currentDraftQuery.data?.creation_step, draftId, isBasicsDirty, savedBasics, serverBasics]);

  const stepOrder = useMemo(() => getVisibleStepOrder(hasSetupPlugins), [hasSetupPlugins]);
  const activeStep = normalizeWizardStep(currentStep, hasSetupPlugins);
  const currentStepIndex = stepOrder.findIndex((step) => step.id === activeStep);
  const currentStepMeta = STEP_META_BY_ID[activeStep];
  useEffect(() => {
    if (activeStep === currentStep) {
      return;
    }
    setStepDirection(STEP_INDEX_BY_ID[activeStep] >= STEP_INDEX_BY_ID[currentStep] ? 1 : -1);
    setCurrentStep(activeStep);
    if (!draftId || !programId) {
      return;
    }
    void api.updateSemesterDraft(draftId, { creation_step: activeStep })
      .then((result) => {
        queryClient.setQueryData(queryKeys.programs.semesterDraft(programId), result);
      })
      .catch((error) => {
        console.error("Failed to normalize Semester wizard step", error);
      });
  }, [activeStep, currentStep, draftId, programId, queryClient]);

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

  const invalidateDraftData = async ({ includeProgramDetail = false }: { includeProgramDetail?: boolean } = {}) => {
    if (!programId) return;
    await Promise.all([
      ...(includeProgramDetail ? [queryClient.invalidateQueries({ queryKey: queryKeys.programs.detail(programId) })] : []),
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.semesterDraft(programId) }),
      ...(draftId ? [queryClient.invalidateQueries({ queryKey: queryKeys.semesters.detail(draftId) })] : []),
      ...(draftId ? [queryClient.invalidateQueries({ queryKey: queryKeys.semesters.pluginActivations(draftId) })] : []),
      ...(draftId ? [queryClient.invalidateQueries({ queryKey: queryKeys.semesters.pluginSystemSetup(draftId) })] : []),
    ]);
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
      creation_step: nextStep ?? activeStep,
    };

    if (!draftId) {
      const currentDraft = await api.getCurrentSemesterDraft(programId);
      if (currentDraft?.id) {
        queryClient.setQueryData(queryKeys.programs.semesterDraft(programId), currentDraft);
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
        queryClient.setQueryData(queryKeys.programs.semesterDraft(programId), resumedDraft);
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
        queryClient.setQueryData(queryKeys.programs.semesterDraft(programId!), result);
        setSavedBasics({
          name: result.name || "",
          start_date: result.start_date ?? todayIso(),
          end_date: result.end_date ?? addDaysIso(111),
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
    enabled: Boolean(draftId) && activeStep === "plugin-setup",
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
      void basicsFlushRef.current();
      void pluginSetupFlushRef.current();
    };
  }, []);

  const flushStepDraftChanges = async (nextStep: StepId) => {
    await basicsFlushRef.current();
    if (activeStep === "plugin-setup" || nextStep === "review") {
      await pluginSetupFlushRef.current();
    }
  };

  const saveStepTransition = async (nextStep: StepId) => {
    const normalizedNextStep = normalizeWizardStep(nextStep, hasSetupPlugins);
    if (!draftId) {
      return persistBasics(normalizedNextStep);
    }
    await flushStepDraftChanges(normalizedNextStep);
    return api.updateSemesterDraft(draftId, { creation_step: normalizedNextStep });
  };

  const goToStep = async (step: StepId) => {
    const nextStep = normalizeWizardStep(step, hasSetupPlugins);
    const nextIndex = stepOrder.findIndex((item) => item.id === nextStep);
    const currentIndex = stepOrder.findIndex((item) => item.id === activeStep);
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
        queryClient.setQueryData(queryKeys.programs.semesterDraft(programId!), result);
      }
      setCurrentStep(nextStep);
    } catch (error) {
      console.error("Failed to change Semester wizard step", error);
      reportError("Failed to change steps. Please retry.");
    } finally {
      setIsSavingStep(false);
    }
  };

  const handleTogglePlugin = async (plugin: ProgramPluginInstallation, checked: boolean) => {
    if (!draftId || !programId) return;
    const draftQueryKey = queryKeys.programs.semesterDraft(programId);
    const semesterDetailQueryKey = queryKeys.semesters.detail(draftId);
    const pluginSystemSetupQueryKey = queryKeys.semesters.pluginSystemSetup(draftId);
    const previousDraft = queryClient.getQueryData<Semester>(draftQueryKey);
    const previousSemester = queryClient.getQueryData<Semester>(semesterDetailQueryKey);
    const previousSetup = queryClient.getQueryData<PluginSystemSemesterSetupResponse>(pluginSystemSetupQueryKey);

    setIsUpdatingPluginSelection(true);
    setCurrentStep("plugins");
    queryClient.setQueryData<Semester>(draftQueryKey, (current) => syncSemesterPluginToggle(current, plugin, checked));
    queryClient.setQueryData<Semester>(semesterDetailQueryKey, (current) => syncSemesterPluginToggle(current, plugin, checked));
    queryClient.setQueryData<PluginSystemSemesterSetupResponse>(pluginSystemSetupQueryKey, (current) => (
      syncPluginSystemSetupResponse(current, plugin.plugin_id, checked)
    ));
    try {
      await api.upsertSemesterPluginActivation(draftId, plugin.plugin_id, {
        is_enabled: checked,
      });
      await api.updateSemesterDraft(draftId, { creation_step: "plugins" });
      await invalidateDraftData();
    } catch (error) {
      queryClient.setQueryData(draftQueryKey, previousDraft);
      queryClient.setQueryData(semesterDetailQueryKey, previousSemester);
      queryClient.setQueryData(pluginSystemSetupQueryKey, previousSetup);
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

    setIsUpdatingPluginSelection(true);
    setCurrentStep("plugins");
    try {
      await Promise.all(
        targets.map((plugin) =>
          api.upsertSemesterPluginActivation(draftId, plugin.plugin_id, {
            is_enabled: checked,
          }),
        ),
      );
      await api.updateSemesterDraft(draftId, { creation_step: "plugins" });
      await invalidateDraftData();
    } catch (error) {
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
      queryClient.setQueryData(queryKeys.programs.semesterDraft(programId!), reviewedDraft);
      if (!reviewedDraft.review_ready) {
        reportError("Resolve the draft review errors before finalizing.");
        return;
      }
      const result = await api.finalizeSemesterDraft(draftId);
      queryClient.setQueryData(queryKeys.programs.semesterDraft(programId!), null);
      queryClient.removeQueries({ queryKey: queryKeys.semesters.pluginSystemSetup(draftId) });
      queryClient.removeQueries({ queryKey: queryKeys.semesters.pluginActivations(draftId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.detail(programId!) }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.semesterDraft(programId!) }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: queryKeys.semesters.detail(result.id) }).catch(() => {});
      navigate(`/semesters/${result.id}`);
    } catch (error) {
      console.error("Failed to finalize Semester draft", error);
      reportError("Failed to finalize the Semester. Please retry.");
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
      await invalidateDraftData({ includeProgramDetail: true });
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
  const reviewReady = Boolean(currentDraftQuery.data?.review_ready ?? semesterDetailQuery.data?.review_ready);
  const reviewErrors = currentDraftQuery.data?.review_errors
    ?? semesterDetailQuery.data?.review_errors
    ?? [];
  const blockedEnabledPlugins = enabledPlugins.filter((plugin) => !plugin.available);
  const hasBlockedEnabledPlugins = blockedEnabledPlugins.length > 0;
  const courseCount = courseList.length;
  const enabledPluginCount = enabledPlugins.length;
  const reviewSummaryPlugins = enabledPlugins.filter((plugin) => (plugin.setup_summary ?? []).length > 0);
  const canFinalize = Boolean(
    draftId &&
    reviewReady &&
    !hasBlockedEnabledPlugins,
  );
  const StepIcon = currentStepMeta.icon;
  const previousStepId = getPreviousStepId(activeStep, hasSetupPlugins);
  const previousStepLabel = previousStepId ? STEP_META_BY_ID[previousStepId].label : null;
  const nextStepId = getNextStepId(activeStep, hasSetupPlugins);
  const nextStepLabel = nextStepId ? STEP_META_BY_ID[nextStepId].label : null;
  const basicsValidation = getSemesterBasicsValidation(basics);
  const isReviewStep = activeStep === "review";
  const isBasicsStep = activeStep === "basics";
  const isBasicsStepInvalid = !basics.name.trim() || !basics.start_date || !basics.end_date || !basicsValidation.isValid;
  const primaryActionLabel = isReviewStep
    ? "Create Semester"
    : nextStepLabel
      ? `Continue to ${nextStepLabel}`
      : "Continue";
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
      minWidthClassName="min-w-[620px] sm:min-w-[720px]"
      renderHeader={() => (
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Credits</TableHead>
          <TableHead>Grade</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      )}
      renderRow={(course) => (
        <TableRow key={course.id}>
          <TableCell className="font-medium">
            <div className="flex flex-col">
              <span>{course.name}</span>
              {course.alias ? (
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {course.alias}
                </span>
              ) : null}
            </div>
          </TableCell>
          <TableCell>{course.credits}</TableCell>
          <TableCell>{formatGpaPercentage(course.grade_percentage)}</TableCell>
          <TableCell className="text-right">
            <DataTableActionMenu triggerLabel={`Open actions for ${course.name}`}>
              <DropdownMenuItem variant="destructive" onClick={() => setPendingRemoveCourse(course)}>
                <Trash2 className="h-4 w-4" />
                Remove
              </DropdownMenuItem>
            </DataTableActionMenu>
          </TableCell>
        </TableRow>
      )}
    />
  );

  const pluginsStepContent = (
    <DataTable
      title="Plugins"
      description="Enable or disable Program plugins for this Semester."
      showHeader={false}
      items={pluginCatalog}
      actionButton={(
        <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
          <span className="text-xs text-muted-foreground">
            Enable All Plugin
          </span>
          <Switch
            checked={pluginCatalog.some((plugin) => !plugin.locked && plugin.available) && pluginCatalog.filter((plugin) => !plugin.locked && plugin.available).every((plugin) => enabledPluginIds.has(plugin.plugin_id))}
            aria-label="Toggle all editable plugins"
            disabled={isUpdatingPluginSelection || !pluginCatalog.some((plugin) => (!plugin.locked && plugin.available) || (!plugin.locked && enabledPluginIds.has(plugin.plugin_id)))}
            onCheckedChange={(checked) => {
              void handleToggleAllPlugins(Boolean(checked));
            }}
          />
        </div>
      )}
      emptyMessage="This Program does not have any installed plugins available for Semester configuration yet."
      minWidthClassName="min-w-[620px] sm:min-w-[720px] xl:min-w-[840px]"
      renderHeader={() => (
        <TableRow>
          <TableHead className="min-w-[220px]">Plugin</TableHead>
          <TableHead className="min-w-[120px]">Author</TableHead>
          <TableHead className="w-[140px] text-right">Enabled</TableHead>
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
      {setupPlugins.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
          No enabled plugins require setup.
        </div>
      ) : (
        <div className="space-y-8">
          {setupPlugins.map((plugin, pluginIndex) => (
            <section key={plugin.plugin_id} className="space-y-4">
              {pluginIndex > 0 ? <Separator /> : null}
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground sm:text-lg">{plugin.display_name}</h3>
                <p className="text-sm text-muted-foreground">{plugin.description}</p>
              </div>
              <div className="space-y-6">
                {plugin.setup_sections.map((section, sectionIndex) => (
                  <div key={section.id} className="space-y-3">
                    {sectionIndex > 0 ? <Separator /> : null}
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-foreground">{section.title}</div>
                      <div className="text-sm text-muted-foreground">{section.description}</div>
                    </div>
                    <div className="space-y-4">
                      {section.fields.map((field) => (
                        <PluginGovernanceFieldControl
                          key={`${plugin.plugin_id}:${section.id}:${field.path}`}
                          field={field}
                          value={pluginSetupDrafts[plugin.plugin_id]?.[field.path] ?? field.default_value}
                          description={field.description}
                          error={plugin.review_errors.find((issue) => issue.field_path === field.path)?.message ?? null}
                          onChange={(value) => updatePluginSetupField(plugin, field.path, value)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );

  const reviewStepContent = (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground sm:text-xl">Basics</h3>
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="text-xs font-medium tracking-wide text-muted-foreground">Semester Name</div>
            <div className="text-base font-semibold text-foreground sm:text-lg">{basics.name || "Untitled Semester"}</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs font-medium tracking-wide text-muted-foreground">Date Range</div>
              <div className="text-sm text-foreground">
                {basics.start_date && basics.end_date
                  ? `${basics.start_date} to ${basics.end_date}`
                  : "Start and end dates are not set yet."}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium tracking-wide text-muted-foreground">Reading Week</div>
              <div className="text-sm text-foreground">
                {basics.reading_week_start && basics.reading_week_end
                  ? `${basics.reading_week_start} to ${basics.reading_week_end}`
                  : "No reading week configured"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Accordion type="multiple" defaultValue={["review-courses", "review-plugins"]} className="rounded-xl border border-border/70 px-4">
        <AccordionItem value="review-courses">
          <AccordionTrigger className="py-5 hover:no-underline">
            <div className="space-y-1 text-left">
              <div className="font-medium text-foreground">Courses</div>
              <div className="text-sm text-muted-foreground">{courseCount} courses</div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-5">
            <div className="space-y-2 text-sm text-muted-foreground">
              {courseCount === 0 ? <div>No draft courses yet.</div> : null}
              {courseList.slice(0, REVIEW_COURSE_PREVIEW_LIMIT).map((course) => (
                <div key={course.id}>{course.name}</div>
              ))}
              {courseCount > REVIEW_COURSE_PREVIEW_LIMIT ? <div>and {courseCount - REVIEW_COURSE_PREVIEW_LIMIT} more</div> : null}
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="review-plugins">
          <AccordionTrigger className="py-5 hover:no-underline">
            <div className="space-y-1 text-left">
              <div className="font-medium text-foreground">Plugins</div>
              <div className="text-sm text-muted-foreground">{enabledPluginCount} enabled</div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-5">
            <div className="space-y-2 text-sm text-muted-foreground">
              {enabledPluginCount === 0 ? <div>No plugins enabled for this Semester.</div> : null}
              {enabledPlugins.map((plugin) => (
                <div key={plugin.plugin_id}>
                  {plugin.display_name}
                  {!plugin.available ? " · Blocked" : ""}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

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
                  <div className="space-y-6">
                    {(plugin.setup_summary ?? []).map((section, sectionIndex) => (
                      <div key={`${plugin.plugin_id}:${section.id}`} className="space-y-3">
                        {sectionIndex > 0 ? <Separator /> : null}
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-foreground">{section.title}</div>
                          {section.description ? <div className="text-sm text-muted-foreground">{section.description}</div> : null}
                        </div>
                        <div className="space-y-2">
                          {section.items.map((item) => (
                            <div key={`${section.id}:${item.path}`} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-3 text-sm">
                              <span className="text-muted-foreground">{item.label}</span>
                              <span className="font-medium text-foreground">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
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
                  {error.plugin_id ? ` · ${error.plugin_id}` : ""}
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
                  className="space-y-6 pr-1"
                >
              {activeStep === "basics" ? basicsStepContent : null}

              {activeStep === "courses" ? coursesStepContent : null}

              {activeStep === "plugins" ? pluginsStepContent : null}

              {activeStep === "plugin-setup" ? pluginSetupStepContent : null}

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
                    {stepOrder.map((step, index) => (
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
                    ))}
                  </PaginationContent>
                </Pagination>
              </div>

              <div className="sm:order-1 sm:flex sm:justify-start">
                {previousStepId || isBasicsStep ? (
                  <Button
                    variant="outline"
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
                    className="w-full sm:w-auto"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {isBasicsStep
                      ? "Back to Program"
                      : previousStepLabel ? `Back to ${previousStepLabel}` : "Back"}
                  </Button>
                ) : (
                  <div className="hidden sm:block" />
                )}
              </div>

              <div className="sm:order-3 sm:flex sm:justify-end">
                <Button onClick={handlePrimaryAction} disabled={isPrimaryActionDisabled} className="w-full sm:w-auto">
                  {primaryActionLabel}
                  {isReviewStep ? null : <ArrowRight className="ml-2 h-4 w-4" />}
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
              {draftId
                ? "Choose whether to keep this draft for later or discard it before returning to the Program dashboard."
                : "You will return to the Program dashboard and the current unsaved setup details will be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {draftId ? (
              <>
                <AlertDialogCancel>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleLeaveWizard}>
                  Keep
                </AlertDialogAction>
                <AlertDialogAction variant="destructive" onClick={() => void handleDiscardDraft()}>
                  Discard
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogCancel onClick={handleLeaveWizard}>
                Leave wizard
              </AlertDialogCancel>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};
