// input:  [program route params, Program/Semester governance APIs, plugin-manifest icon helpers, existing course CRUD APIs, query cache, shadcn form/layout primitives, and motion helpers]
// output: [`CreateSemesterWizardPage` route component]
// pos:    [Standalone Semester creation host that owns the draft lifecycle, a Semester-settings-aligned shadcn basics step, animated shell transitions, plugin-level enablement, plugin setup orchestration, and final review]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel, FieldSet } from "@/components/ui/field";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
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
import { CrudPanel } from "../components/CrudPanel";
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
import api, { type ProgramPluginInstallation } from "../services/api";

type StepId = "basics" | "courses" | "plugins" | "plugin-setup" | "review";

type BasicsDraft = SemesterBasicsValue;

type ActivationDraftMap = Record<string, {
  semester_overrides: Record<string, unknown>;
  setup_state: Record<string, unknown>;
}>;

const STEP_ORDER: Array<{
  id: StepId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  detail: string;
}> = [
  { id: "basics", label: "Basics", icon: Sparkles, detail: "" },
  { id: "courses", label: "Courses", icon: BookOpen, detail: "Populate the initial draft-owned course set." },
  { id: "plugins", label: "Plugins", icon: Layers3, detail: "Choose which Program plugins this Semester can use." },
  { id: "plugin-setup", label: "Plugin Setup", icon: Settings2, detail: "Resolve host-rendered plugin setup contributions." },
  { id: "review", label: "Review", icon: CheckCircle2, detail: "Validate every blocker before activation." },
];

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

export const CreateSemesterWizardPage: React.FC = () => {
  const { id: programId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [currentStep, setCurrentStep] = useState<StepId>("basics");
  const [stepDirection, setStepDirection] = useState(1);
  const [basics, setBasics] = useState<BasicsDraft>(makeInitialBasics);
  const [isCourseManagerOpen, setIsCourseManagerOpen] = useState(false);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [activationDrafts, setActivationDrafts] = useState<ActivationDraftMap>({});
  const [savedBasics, setSavedBasics] = useState<BasicsDraft>(makeInitialBasics);
  const [savedActivationDrafts, setSavedActivationDrafts] = useState<ActivationDraftMap>({});
  const basicsFlushRef = useRef<() => Promise<void>>(async () => {});
  const activationFlushRef = useRef<() => Promise<void>>(async () => {});

  const programQuery = useQuery({
    queryKey: programId ? queryKeys.programs.detail(programId) : ["programs", "missing"],
    queryFn: () => api.getProgram(programId!),
    enabled: Boolean(programId),
    staleTime: 60_000,
  });

  const currentDraftQuery = useQuery({
    queryKey: programId ? queryKeys.programs.semesterDraft(programId) : ["draft", "missing"],
    queryFn: () => api.getCurrentSemesterDraft(programId!),
    enabled: Boolean(programId),
    staleTime: 10_000,
  });

  const draftId = currentDraftQuery.data?.id;
  const semesterDetailQuery = useQuery({
    queryKey: draftId ? queryKeys.semesters.detail(draftId) : ["semesters", "draft", "missing"],
    queryFn: () => api.getSemester(draftId!),
    enabled: Boolean(draftId),
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
  const setupPlugins = useMemo(
    () => enabledPlugins.filter((plugin) => plugin.setup_sections.length > 0),
    [enabledPlugins],
  );
  const currentStepIndex = useMemo(
    () => Math.max(STEP_ORDER.findIndex((step) => step.id === currentStep), 0),
    [currentStep],
  );
  const currentStepMeta = STEP_ORDER[currentStepIndex] ?? STEP_ORDER[0];
  const progressValue = STEP_ORDER.length > 1
    ? (currentStepIndex / (STEP_ORDER.length - 1)) * 100
    : 0;

  useEffect(() => {
    const draft = currentDraftQuery.data;
    if (!draft) return;
    const nextBasics = {
      name: draft.name || "",
      start_date: draft.start_date ?? todayIso(),
      end_date: draft.end_date ?? addDaysIso(111),
      reading_week_start: draft.reading_week_start ?? "",
      reading_week_end: draft.reading_week_end ?? "",
    };
    setBasics(nextBasics);
    setSavedBasics(nextBasics);
    if (draft.creation_step) {
      setCurrentStep(draft.creation_step as StepId);
    }
  }, [currentDraftQuery.data]);

  useEffect(() => {
    if (pluginActivations.length === 0) {
      setActivationDrafts({});
      setSavedActivationDrafts({});
      return;
    }
    const nextDrafts = Object.fromEntries(
      pluginActivations.map((plugin) => [
        plugin.plugin_id,
        {
          semester_overrides: { ...plugin.semester_overrides },
          setup_state: { ...plugin.setup_state },
        },
      ]),
    );
    setActivationDrafts(nextDrafts);
    setSavedActivationDrafts(nextDrafts);
  }, [pluginActivations]);

  const invalidateDraftData = async () => {
    if (!programId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.detail(programId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.programs.semesterDraft(programId) }),
      ...(draftId ? [queryClient.invalidateQueries({ queryKey: queryKeys.semesters.detail(draftId) })] : []),
      ...(draftId ? [queryClient.invalidateQueries({ queryKey: queryKeys.semesters.pluginActivations(draftId) })] : []),
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
      creation_step: nextStep ?? currentStep,
    };

    if (!draftId) {
      return api.createSemesterDraft(programId, payload);
    }
    return api.updateSemesterDraft(draftId, payload);
  };

  const { flush: flushBasics } = useAutoSave({
    value: basics,
    savedValue: savedBasics,
    enabled: Boolean(draftId) && currentStep === "basics",
    debounceMs: 400,
    maxWaitMs: 1500,
    onSave: async (snapshot) => {
      if (!draftId) return;
      const result = await persistBasics(currentStep, snapshot);
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
    value: activationDrafts,
    savedValue: savedActivationDrafts,
    enabled: Boolean(draftId) && currentStep === "plugin-setup",
    debounceMs: 400,
    maxWaitMs: 1500,
    onSave: async (snapshot) => {
      if (!draftId) return;
      for (const plugin of setupPlugins) {
        const pluginDraft = snapshot[plugin.plugin_id];
        if (!pluginDraft) continue;
        await api.upsertSemesterPluginActivation(draftId, plugin.plugin_id, pluginDraft);
      }
      setSavedActivationDrafts(snapshot);
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
    activationFlushRef.current = flushPluginSetup;
  }, [flushPluginSetup]);

  useEffect(() => {
    return () => {
      void basicsFlushRef.current();
      void activationFlushRef.current();
    };
  }, []);

  const goToStep = async (step: StepId) => {
    const nextIndex = STEP_ORDER.findIndex((entry) => entry.id === step);
    const currentIndex = STEP_ORDER.findIndex((entry) => entry.id === currentStep);
    if (nextIndex === -1) return;
    setStepDirection(nextIndex >= currentIndex ? 1 : -1);
    setIsSavingStep(true);
    try {
      let result = null;
      if (!draftId) {
        result = await persistBasics(step);
      } else {
        await basicsFlushRef.current();
        if (currentStep === "plugin-setup" || step === "review") {
          await activationFlushRef.current();
        }
        result = await api.updateSemesterDraft(draftId, { creation_step: step });
      }
      if (step === "review" && result?.id) {
        result = await api.reviewSemesterDraft(result.id);
      }
      await invalidateDraftData();
      if (result?.id) {
        queryClient.setQueryData(queryKeys.programs.semesterDraft(programId!), result);
      }
      setCurrentStep(step);
    } catch (error) {
      console.error("Failed to change Semester wizard step", error);
      reportError("Failed to change steps. Please retry.");
    } finally {
      setIsSavingStep(false);
    }
  };

  const handleTogglePlugin = async (plugin: ProgramPluginInstallation, checked: boolean) => {
    if (!draftId) return;
    try {
      if (checked) {
        await api.upsertSemesterPluginActivation(draftId, plugin.plugin_id, {
          ...(activationDrafts[plugin.plugin_id] ?? {}),
          is_enabled: true,
        });
      } else {
        await api.upsertSemesterPluginActivation(draftId, plugin.plugin_id, {
          ...(activationDrafts[plugin.plugin_id] ?? {}),
          is_enabled: false,
        });
      }
      await api.updateSemesterDraft(draftId, { creation_step: "plugins" });
      await invalidateDraftData();
    } catch (error) {
      console.error("Failed to toggle plugin in Semester wizard", error);
      reportError("Failed to update plugin enablement. Please retry.");
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      await api.deleteCourse(courseId);
      await invalidateDraftData();
    } catch (error) {
      console.error("Failed to delete course from Semester draft", error);
      reportError("Failed to delete the course. Please retry.");
    }
  };

  const handleFinalize = async () => {
    if (!draftId) return;
    setIsFinalizing(true);
    try {
      await basicsFlushRef.current();
      await activationFlushRef.current();
      const reviewedDraft = await api.reviewSemesterDraft(draftId);
      queryClient.setQueryData(queryKeys.programs.semesterDraft(programId!), reviewedDraft);
      if (!reviewedDraft.review_ready) {
        reportError("Resolve the draft review errors before finalizing.");
        return;
      }
      const result = await api.finalizeSemesterDraft(draftId);
      await invalidateDraftData();
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
      await invalidateDraftData();
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
  const reviewErrors = currentDraftQuery.data?.review_errors ?? [];
  const blockedEnabledPlugins = enabledPlugins.filter((plugin) => !plugin.available);
  const hasBlockedEnabledPlugins = blockedEnabledPlugins.length > 0;
  const reviewSummaryPlugins = enabledPlugins.filter((plugin) => (plugin.setup_summary ?? []).length > 0);
  const reviewBlockerCount = reviewErrors.length + blockedEnabledPlugins.length;
  const canFinalize = Boolean(
    draftId &&
    reviewReady &&
    !hasBlockedEnabledPlugins,
  );
  const StepIcon = currentStepMeta.icon;
  const previousStepMeta = STEP_ORDER[currentStepIndex - 1] ?? null;
  const previousStepId = currentStep === "review"
    ? (setupPlugins.length > 0 ? "plugin-setup" : "plugins")
    : (previousStepMeta?.id ?? null);
  const previousStepLabel = previousStepId ? STEP_ORDER.find((step) => step.id === previousStepId)?.label ?? null : null;
  const nextStepId = currentStep === "basics"
    ? "courses"
    : currentStep === "courses"
      ? "plugins"
      : currentStep === "plugins"
        ? (setupPlugins.length > 0 ? "plugin-setup" : "review")
        : currentStep === "plugin-setup"
          ? "review"
          : null;
  const nextStepLabel = nextStepId ? STEP_ORDER.find((step) => step.id === nextStepId)?.label ?? null : null;
  const currentStepDetail = currentStep === "courses"
    ? (courseList.length > 0 ? `${courseList.length} courses added so far.` : "Add the courses included in this Semester.")
    : currentStep === "plugins"
      ? (enabledPlugins.length > 0 ? `${enabledPlugins.length} plugins enabled for this Semester.` : "Choose which Program plugins should be available in this Semester.")
      : currentStep === "plugin-setup"
        ? (setupPlugins.length > 0 ? `${setupPlugins.length} plugins still need setup.` : "No additional plugin setup is required.")
        : currentStep === "review"
          ? (reviewBlockerCount > 0 ? "Resolve blockers before finalizing." : reviewReady ? "Review complete. Ready to finalize." : "Review pending.")
          : currentStepMeta.detail;
  const basicsValidation = getSemesterBasicsValidation(basics);
  const primaryActionLabel = currentStep === "review"
    ? "Finalize Semester"
    : nextStepLabel
      ? `Continue to ${nextStepLabel}`
      : "Continue";
  const isPrimaryActionDisabled = currentStep === "review"
    ? (!canFinalize || isFinalizing)
    : currentStep === "basics"
      ? (isSavingStep || !basics.name.trim() || !basics.start_date || !basics.end_date || !basicsValidation.isValid)
      : isSavingStep;
  const handlePrimaryAction = () => {
    if (currentStep === "review") {
      void handleFinalize();
      return;
    }

    if (nextStepId) {
      void goToStep(nextStepId);
    }
  };

  return (
    <Layout breadcrumb={breadcrumb}>
      <Container className="flex h-[calc(100svh-60px)] flex-col gap-6 overflow-hidden pt-8 pb-0">
        <section className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <header className="shrink-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-3">
                  <StepIcon className="h-6 w-6 shrink-0 text-muted-foreground sm:h-7 sm:w-7" />
                  <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">{currentStepMeta.label}</h1>
                </div>
                {currentStepDetail ? <p className="text-sm text-muted-foreground">{currentStepDetail}</p> : null}
              </div>
              <div className="shrink-0 self-start pt-1 text-sm font-medium tabular-nums text-muted-foreground">
                {progressValue.toFixed(0)}%
              </div>
            </div>

            <Field className="w-full">
              <Progress value={progressValue} id="semester-setup-progress" />
            </Field>

            <Separator />
          </header>

          <ScrollArea className="min-h-0 flex-1">
            <div className="px-0 pt-4 pb-28 sm:pb-24">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentStep}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: stepDirection > 0 ? 28 : -28, y: 6 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: stepDirection > 0 ? -22 : 22, y: -4 }}
                  transition={prefersReducedMotion ? { duration: 0.12 } : { type: "spring", stiffness: 320, damping: 32, mass: 0.8 }}
                  className="space-y-6 pr-1"
                >
              {currentStep === "basics" ? (
                <FieldSet>
                  <SemesterBasicsFields
                    value={basics}
                    onChange={(nextBasics) => setBasics(nextBasics)}
                    showRequiredIndicators
                  />
                </FieldSet>
              ) : null}

              {currentStep === "courses" ? (
                <CrudPanel
                  title="Courses"
                  description="Manage all courses in this Semester draft."
                  showHeader={false}
                  items={courseList}
                  actionButton={(
                    <Button onClick={() => setIsCourseManagerOpen(true)} disabled={!draftId} className="w-full sm:w-auto">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Course
                    </Button>
                  )}
                  emptyMessage="No courses have been added to this draft yet."
                  minWidthClassName="min-w-[560px] sm:min-w-[640px] lg:min-w-[720px]"
                  renderHeader={() => (
                    <TableRow>
                      <TableHead className="min-w-[220px]">Course</TableHead>
                      <TableHead className="min-w-[140px]">Alias</TableHead>
                      <TableHead className="w-px text-right">Credits</TableHead>
                      <TableHead className="w-px text-right">Actions</TableHead>
                    </TableRow>
                  )}
                  renderRow={(course) => (
                    <TableRow key={course.id}>
                      <TableCell className="max-w-[18rem] whitespace-normal break-words py-3">
                        <div className="font-medium text-foreground">{course.name}</div>
                      </TableCell>
                      <TableCell className="py-3 text-muted-foreground">
                        {course.alias?.trim() || "—"}
                      </TableCell>
                      <TableCell className="w-px py-3 text-right text-muted-foreground whitespace-nowrap">
                        {course.credits.toFixed(1)}
                      </TableCell>
                      <TableCell className="w-px py-3 text-right">
                        <Button variant="outline" size="icon" onClick={() => void handleDeleteCourse(course.id)} aria-label={`Delete ${course.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                />
              ) : null}

              {currentStep === "plugins" ? (
                <CrudPanel
                  title="Plugins"
                  description="Enable or disable Program plugins for this Semester."
                  showHeader={false}
                  items={pluginCatalog}
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
                      <TableRow key={plugin.plugin_id} className="align-top">
                        <TableCell className="max-w-[20rem] whitespace-normal break-words py-3">
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
                        <TableCell className="py-3 align-top">
                          <span className="text-sm text-muted-foreground">{plugin.author}</span>
                        </TableCell>
                        <TableCell className="py-3 text-right align-top">
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
              ) : null}

              {currentStep === "plugin-setup" ? (
                <div className="space-y-6">
                      {setupPlugins.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/70 px-4 py-12 text-center text-sm text-muted-foreground">
                          No enabled plugins require setup.
                        </div>
                      ) : (
                        <Accordion type="single" collapsible defaultValue={setupPlugins[0]?.plugin_id} className="rounded-xl border border-border/70 px-4">
                          {setupPlugins.map((plugin) => (
                            <AccordionItem key={plugin.plugin_id} value={plugin.plugin_id}>
                              <AccordionTrigger className="gap-4 py-5 hover:no-underline">
                                <div className="space-y-1">
                                  <div className="font-medium text-foreground">{plugin.display_name}</div>
                                  <div className="text-sm text-muted-foreground">{plugin.description}</div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="pb-1">
                                <div className="space-y-6">
                                  {plugin.setup_sections.map((section, sectionIndex) => (
                                    <div key={section.id} className="space-y-3">
                                      {sectionIndex > 0 ? <Separator /> : null}
                                      <div className="space-y-1">
                                        <div className="text-sm font-medium text-foreground">{section.title}</div>
                                        <div className="text-sm text-muted-foreground">{section.description}</div>
                                      </div>
                                      <div className="space-y-4">
                                        {section.fields.map((field) => (
                                          <PluginGovernanceFieldControl
                                            key={`${plugin.plugin_id}:${section.id}:${field.path}`}
                                            field={field}
                                            value={activationDrafts[plugin.plugin_id]?.setup_state?.[field.path] ?? activationDrafts[plugin.plugin_id]?.semester_overrides?.[field.path] ?? field.default}
                                            description={field.description}
                                            onChange={(value) => setActivationDrafts((current) => ({
                                              ...current,
                                              [plugin.plugin_id]: {
                                                semester_overrides: plugin.fields.some((candidate) => candidate.path === field.path && candidate.scope === "semester-override")
                                                  ? {
                                                      ...(current[plugin.plugin_id]?.semester_overrides ?? plugin.semester_overrides),
                                                      [field.path]: value,
                                                    }
                                                  : (current[plugin.plugin_id]?.semester_overrides ?? plugin.semester_overrides),
                                                setup_state: {
                                                  ...(current[plugin.plugin_id]?.setup_state ?? plugin.setup_state),
                                                  [field.path]: value,
                                                },
                                              },
                                            }))}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      )}

                </div>
              ) : null}

              {currentStep === "review" ? (
                <div className="space-y-6">
                      <div className="grid gap-4 lg:grid-cols-3">
                        <Card size="sm" className="border-border/70 shadow-none">
                          <CardHeader>
                            <CardTitle>Basics</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <div className="font-medium text-foreground">{basics.name}</div>
                            <div>{basics.start_date} to {basics.end_date}</div>
                            <div>
                              {basics.reading_week_start && basics.reading_week_end
                                ? `Reading week: ${basics.reading_week_start} to ${basics.reading_week_end}`
                                : "No reading week configured"}
                            </div>
                          </CardContent>
                        </Card>
                        <Card size="sm" className="border-border/70 shadow-none">
                          <CardHeader>
                            <CardTitle>Courses</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <div className="font-medium text-foreground">{courseList.length} courses</div>
                            {courseList.length === 0 ? <div>No draft courses yet.</div> : null}
                            {courseList.slice(0, 4).map((course) => (
                              <div key={course.id}>{course.name}</div>
                            ))}
                            {courseList.length > 4 ? <div>and {courseList.length - 4} more</div> : null}
                          </CardContent>
                        </Card>
                        <Card size="sm" className="border-border/70 shadow-none">
                          <CardHeader>
                            <CardTitle>Plugins</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <div className="font-medium text-foreground">{enabledPlugins.length} enabled</div>
                            {enabledPlugins.length === 0 ? <div>No plugins enabled for this Semester.</div> : null}
                            {enabledPlugins.map((plugin) => (
                              <div key={plugin.plugin_id}>
                                {plugin.display_name}
                                {!plugin.available ? " · Blocked" : ""}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      </div>

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
                                  {error.step === "plugin-setup" ? "Plugin Setup" : error.step === "plugins" ? "Plugins" : "Basics"}
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
                    {STEP_ORDER.map((step, index) => (
                      <PaginationItem key={step.id}>
                        <Button
                          type="button"
                          variant={currentStep === step.id ? "outline" : "ghost"}
                          size="icon"
                          aria-current={currentStep === step.id ? "page" : undefined}
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
                {previousStepId || currentStep === "basics" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (currentStep === "basics") {
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
                    {currentStep === "basics"
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
                  {currentStep === "review" ? null : <ArrowRight className="ml-2 h-4 w-4" />}
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
