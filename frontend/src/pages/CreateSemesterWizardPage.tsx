// input:  [program route params, Program/Semester governance APIs including plugin-system setup routes, axios-backed draft-conflict inspection, app-side Program/Semester resource queries plus draft cache helpers, plugin-manifest icon helpers, existing course CRUD APIs, query cache, shadcn form/layout primitives, motion helpers, plugin setup definitions/validation helpers, and shared data-table row-actions dropdown helpers]
// output: [`CreateSemesterWizardPage` route component with animated step-scoped header/content render blocks, draft-resume-safe create-or-update basics persistence, per-plugin setup wizard steps, guarded initial draft loading plus explicit unavailable-state handling, guarded server-to-local draft hydration, custom-or-DSL plugin setup validation, setup-step visibility sourced from activation-plus-plugin-system payloads, setup-step saves, custom setup context wiring for draft-semester APIs, finalize-safe draft teardown, blank-by-default semester dates for new local drafts, a unified Program-exit confirmation dialog, merged review-status/blocker rendering, tighter review-summary typography/layout, overflow-safe condensed wizard pagination for large step counts, and animated compact bottom navigation labels]
// pos:    [Standalone Semester creation host that owns the draft lifecycle, step navigation, a Semester-settings-aligned shadcn basics step, synchronized smooth header/content step transitions, per-plugin setup orchestration, host-validated plugin setup review handoff, guarded initial loading so local edits do not race draft hydration, refetch-safe local draft state, duplicate-free plugin setup shells, activation-plus-plugin-system-aware setup-step visibility and review summaries, display-name-aware review blockers, unified Program-exit choices, and polished bottom action transitions]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { programKeys, semesterKeys } from "@/data/keys";
import {
  getProgramDetailQueryOptions,
  getProgramSemesterDraftQueryOptions,
  getSemesterDetailQueryOptions,
  getSemesterPluginSystemSetupQueryOptions,
  invalidateSemesterDraftWorkflowQueries,
  removeSemesterDraftWorkflowQueries,
  seedSemesterDetailFromDraft,
} from "@/data/resources";
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
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getPluginSetupDefinitionById, validatePluginSetupDefinition, type PluginSetupValidationIssue } from "@/plugin-system";

import { AppEmptyState } from "../components/AppEmptyState";
import { Container } from "../components/Container";
import { CourseManagerModal } from "../components/CourseManagerModal";
import { Layout } from "../components/Layout";
import { getSemesterBasicsValidation } from "../components/SemesterBasicsFields";
import { isAutoSaveError, useAutoSave } from "../hooks/useAutoSave";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { reportError } from "../services/appStatus";
import api, {
  type Course,
  type PluginSystemSemesterSetupPlugin,
  type ProgramPluginInstallation,
  type Semester,
} from "../services/api";

// ─── Sub-module imports ───────────────────────────────────────────────────────
import type { BasicsDraft, PluginSetupDraftMap, StepId, StoredStepId } from "./createSemesterWizard/types";
import {
  applyDraftPayloadToWizardCaches,
  areBasicsEqual,
  arePluginSetupDraftsEqual,
  buildPaginationStepTokens,
  buildReviewPreviewText,
  buildSetupStepPlugin,
  contributesSemesterSetup,
  getErrorMessage,
  getPersistedStepId,
  getPluginIdFromStepId,
  getVisibleStepOrder,
  isSemesterDraftExistsError,
  makeInitialBasics,
  mergeSemesterDraftPayload,
  normalizeWizardStep,
  syncSemesterPluginToggle,
} from "./createSemesterWizard/utils";
import { WizardBasicsStep } from "./createSemesterWizard/WizardBasicsStep";
import { WizardCoursesStep } from "./createSemesterWizard/WizardCoursesStep";
import { WizardPluginsStep } from "./createSemesterWizard/WizardPluginsStep";
import { WizardPluginSetupStep } from "./createSemesterWizard/WizardPluginSetupStep";
import { WizardReviewStep } from "./createSemesterWizard/WizardReviewStep";

// Re-export so tests can import buildPaginationStepTokens from this module path.
export { buildPaginationStepTokens } from "./createSemesterWizard/utils";

// ─── Component ────────────────────────────────────────────────────────────────

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
  // Synchronous guard for handleFinalize — setIsFinalizing(true) is a batched React state update
  // and cannot prevent a second invocation in the same event-loop burst (rapid double-click).
  const isFinalizingRef = useRef(false);

  // ─── Queries ────────────────────────────────────────────────────────────────

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

  // ─── Seed semesterDetailQuery cache from draft to eliminate Round-Trip 3 ────
  //
  // currentDraftQuery already returns the full Semester object. Without this
  // effect, semesterDetailQuery would re-fetch the same data under a different
  // cache key as soon as draftId became available.  By seeding the detail slot
  // with the draft payload we turn the subsequent semesterDetailQuery into a
  // synchronous cache-hit while still allowing later invalidations to overwrite
  // the slot with fresher data (seedSemesterDetailFromDraft uses `current ?? draft`).
  useEffect(() => {
    const draft = currentDraftQuery.data;
    if (!draft?.id) return;
    seedSemesterDetailFromDraft(queryClient, draft);
  }, [currentDraftQuery.data, queryClient]);

  // ─── Derived data ────────────────────────────────────────────────────────────

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

  // ─── Draft hydration effects ──────────────────────────────────────────────────

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
    // activeStep IS normalizeWizardStep(currentStep, setupStepPlugins) by definition — reuse it.
    const previousIndex = stepOrder.findIndex((step) => step.id === activeStep);
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

  // ─── Draft persistence ────────────────────────────────────────────────────────

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

  // Keep flush refs in sync via useLayoutEffect instead of a direct render-phase mutation.
  // useLayoutEffect runs synchronously in the commit phase (before paint), which gives the
  // same "no stale flush on fast unmount" guarantee as an inline assignment does, but without
  // the render-phase side effect that causes React Compiler to bail out of the whole component.
  useLayoutEffect(() => {
    basicsFlushRef.current = flushBasics;
    pluginSetupFlushRef.current = flushPluginSetup;
  });

  useEffect(() => {
    return () => {
      void basicsFlushRef.current().catch(() => {});
      void pluginSetupFlushRef.current().catch(() => {});
    };
  }, []);

  // ─── Navigation ───────────────────────────────────────────────────────────────

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

  // ─── Plugin handlers ─────────────────────────────────────────────────────────

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

  // ─── Course handlers ─────────────────────────────────────────────────────────

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

  // ─── Finalize / exit ─────────────────────────────────────────────────────────

  const handleFinalize = async () => {
    // isFinalizingRef is a synchronous guard — setIsFinalizing(true) is batched and cannot
    // prevent a second invocation that arrives in the same event-loop burst (rapid double-click).
    if (!draftId || isFinalizingRef.current) return;
    isFinalizingRef.current = true;
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
      // Await all cache invalidations before navigating so the Semester homepage
      // does not land on stale program/draft/semester data.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: programKeys.detail(programId!) }),
        queryClient.invalidateQueries({ queryKey: programKeys.semesterDraft(programId!) }),
        queryClient.invalidateQueries({ queryKey: semesterKeys.detail(result.id) }),
      ]).catch(() => {});
      navigate(`/semesters/${result.id}`);
    } catch (error) {
      console.error("Failed to finalize Semester draft", error);
      if (!isAutoSaveError(error)) {
        reportError("Failed to finalize the Semester. Please retry.");
      }
    } finally {
      isFinalizingRef.current = false;
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

  // ─── Plugin setup field update ────────────────────────────────────────────────

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

  // ─── Breadcrumb (shared across all return paths) ──────────────────────────────

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

  // ─── Early returns (guarded states) ──────────────────────────────────────────

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

  // ─── Pre-render derived values ────────────────────────────────────────────────

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
  // blockedEnabledPlugins is already filtered above — reuse it to avoid a redundant traversal.
  const blockedPluginCount = blockedEnabledPlugins.length;
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

  // Pre-filtered to avoid double-scanning in WizardPluginsStep's Select-All Switch.
  const toggleableAvailablePlugins = pluginCatalog.filter((plugin) => !plugin.locked && plugin.available);

  // ─── Render ───────────────────────────────────────────────────────────────────

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
                  {activeStep === "basics" ? (
                    <WizardBasicsStep value={basics} onChange={setBasics} />
                  ) : null}

                  {activeStep === "courses" ? (
                    <WizardCoursesStep
                      courseList={courseList}
                      draftId={draftId}
                      onOpenCourseManager={() => setIsCourseManagerOpen(true)}
                      onRequestRemoveCourse={setPendingRemoveCourse}
                    />
                  ) : null}

                  {activeStep === "plugins" ? (
                    <WizardPluginsStep
                      pluginCatalog={pluginCatalog}
                      enabledPluginIds={enabledPluginIds}
                      toggleableAvailablePlugins={toggleableAvailablePlugins}
                      isUpdatingPluginSelection={isUpdatingPluginSelection}
                      onTogglePlugin={handleTogglePlugin}
                      onToggleAll={handleToggleAllPlugins}
                    />
                  ) : null}

                  {activeStep !== "basics" && activeStep !== "courses" && activeStep !== "plugins" && activeStep !== "review" ? (
                    <WizardPluginSetupStep
                      setupPlugins={setupPlugins}
                      activeStep={activeStep}
                      pluginSetupDrafts={pluginSetupDrafts}
                      pluginSetupValidationErrors={pluginSetupValidationErrors}
                      semesterId={draftId}
                      programId={programId}
                      onValueChange={updatePluginSetupField}
                    />
                  ) : null}

                  {activeStep === "review" ? (
                    <WizardReviewStep
                      semesterName={basics.name}
                      reviewDateRange={reviewDateRangeValue}
                      reviewReadingWeek={reviewReadingWeekValue}
                      courseReviewMeta={courseReviewMeta}
                      courseReviewSummary={courseReviewSummary}
                      pluginReviewMeta={pluginReviewMeta}
                      pluginReviewSummary={pluginReviewSummary}
                      reviewSummaryPlugins={reviewSummaryPlugins}
                      pluginSetupDrafts={pluginSetupDrafts}
                      reviewErrors={reviewErrors}
                      blockedEnabledPlugins={blockedEnabledPlugins}
                      pluginDisplayNameById={pluginDisplayNameById}
                      semesterId={draftId}
                      programId={programId}
                    />
                  ) : null}
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
