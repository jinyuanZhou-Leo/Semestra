// input:  [initial course fields (name/alias/category/custom color/credits/GPA flags), resolved Program default color metadata, LMS link state and available LMS courses, Program Home pin state, color picker UI, and auto-save callback]
// output: [`CourseSettingsPanel` component]
// pos:    [Settings form section for editing per-course metadata, managing LMS linkage, and controlling whether this Course is pinned to Program Home with unpin confirmation]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker, type ColorPickerPreset } from "@/components/ui/color-picker";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { AppEmptyState } from "@/components/AppEmptyState";
import { SettingsSection } from "./SettingsSection";
import { ResponsiveDialogDrawer } from "./ResponsiveDialogDrawer";
import { useAutoSave } from "@/hooks/useAutoSave";
import { cn } from "@/lib/utils";
import { normalizeSubjectCode, resolveCourseSubjectCode } from "@/utils/courseCategoryBadge";
import canvasLogo from "@/assets/canvas-icon.png";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import type { LmsCourseLinkSummary, LmsCourseSummary } from "@/services/api";
import { Link2, Pencil, RefreshCw, Search, Unplug } from "lucide-react";

const COURSE_COLOR_PRESETS: readonly ColorPickerPreset[] = [
  { name: 'Blue', value: '#2563eb' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Teal', value: '#0f766e' },
  { name: 'Amber', value: '#ca8a04' },
  { name: 'Sky', value: '#0ea5e9' },
];

const YEAR_PATTERN = /\b(20\d{2})\b/;

const extractLmsCourseYear = (course: LmsCourseSummary): string | null => {
  for (const candidate of [course.start_at, course.end_at]) {
    if (typeof candidate === 'string' && candidate.length >= 4) {
      const year = candidate.slice(0, 4);
      if (/^\d{4}$/.test(year)) return year;
    }
  }
  for (const candidate of [course.name, course.course_code]) {
    if (typeof candidate !== 'string') continue;
    const matched = candidate.match(YEAR_PATTERN)?.[1];
    if (matched) return matched;
  }
  return null;
};

const LMS_PROVIDER_ICONS: Record<string, { src: string; alt: string }> = {
  canvas: {
    src: canvasLogo,
    alt: "Canvas",
  },
};

interface CourseSettingsPanelProps {
  initialName: string;
  initialSettings: {
    alias?: string;
    category?: string;
    color?: string | null;
    credits?: number;
    include_in_gpa?: boolean;
    hide_gpa?: boolean;
  };
  resolvedDefaultColor?: string | null;
  lmsLink?: LmsCourseLinkSummary | null;
  lmsIntegrationEnabled?: boolean;
  availableLmsCourses?: LmsCourseSummary[];
  onLinkCourse?: (data: { external_course_id: string; sync_enabled: boolean }) => Promise<void>;
  onSyncCourseLink?: (data?: { sync_enabled?: boolean }) => Promise<void>;
  onUnlinkCourse?: () => Promise<void>;
  initialPinnedToHomepage?: boolean;
  onTogglePinnedToHomepage?: (nextValue: boolean) => Promise<void>;
  onSave: (data: {
    name: string;
    alias: string | null;
    category: string | null;
    color: string | null;
    credits: number;
    include_in_gpa: boolean;
    hide_gpa: boolean;
  }) => Promise<void>;
  registerFlush?: (flush: () => Promise<void>) => void;
}

export const CourseSettingsPanel: React.FC<CourseSettingsPanelProps> = ({
  initialName,
  initialSettings,
  resolvedDefaultColor,
  lmsLink = null,
  lmsIntegrationEnabled = false,
  availableLmsCourses = [],
  onLinkCourse,
  onSyncCourseLink,
  onUnlinkCourse,
  initialPinnedToHomepage = false,
  onTogglePinnedToHomepage,
  onSave,
  registerFlush,
}) => {
  const automaticColor = resolvedDefaultColor || "#3b82f6";
  const [name, setName] = useState(initialName);
  const [alias, setAlias] = useState(initialSettings?.alias || "");
  const [category, setCategory] = useState(initialSettings?.category || "");
  const [useCustomColor, setUseCustomColor] = useState(Boolean(initialSettings?.color));
  const [color, setColor] = useState(initialSettings?.color || automaticColor);
  const [credits, setCredits] = useState(String(initialSettings?.credits || ""));
  const [includeInGpa, setIncludeInGpa] = useState(initialSettings?.include_in_gpa ?? true);
  const [hideGpa, setHideGpa] = useState(initialSettings?.hide_gpa ?? false);
  const [lmsSyncEnabled, setLmsSyncEnabled] = useState(lmsLink?.sync_enabled ?? true);
  const [isLmsBusy, setIsLmsBusy] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkYear, setLinkYear] = useState('all');
  const [isPinnedToHomepage, setIsPinnedToHomepage] = useState(initialPinnedToHomepage);
  const [isConfirmingUnpin, setIsConfirmingUnpin] = useState(false);
  const fieldId = useId();
  const initialAlias = initialSettings?.alias || "";
  const initialCategory = initialSettings?.category || "";
  const initialColor = initialSettings?.color || automaticColor;
  const initialUseCustomColor = Boolean(initialSettings?.color);
  const initialCredits = String(initialSettings?.credits || "");
  const initialIncludeInGpa = initialSettings?.include_in_gpa ?? true;
  const initialHideGpa = initialSettings?.hide_gpa ?? false;
  const savedSnapshot = useMemo(
    () => ({
      name: initialName,
      alias: initialAlias,
      category: initialCategory,
      useCustomColor: initialUseCustomColor,
      color: initialColor,
      credits: initialCredits,
      includeInGpa: initialIncludeInGpa,
      hideGpa: initialHideGpa,
    }),
    [
      initialAlias,
      initialCategory,
      initialColor,
      initialCredits,
      initialHideGpa,
      initialIncludeInGpa,
      initialName,
      initialUseCustomColor,
    ]
  );
  const draftSnapshot = useMemo(
    () => ({
      name,
      alias,
      category,
      useCustomColor,
      color,
      credits,
      includeInGpa,
      hideGpa,
    }),
    [alias, category, color, credits, hideGpa, includeInGpa, name, useCustomColor]
  );
  const lastLoadedSnapshotRef = useRef(savedSnapshot);

  useEffect(() => {
    const previousSnapshot = lastLoadedSnapshotRef.current;
    const externalChanged =
      previousSnapshot.name !== savedSnapshot.name ||
      previousSnapshot.alias !== savedSnapshot.alias ||
      previousSnapshot.category !== savedSnapshot.category ||
      previousSnapshot.useCustomColor !== savedSnapshot.useCustomColor ||
      previousSnapshot.color !== savedSnapshot.color ||
      previousSnapshot.credits !== savedSnapshot.credits ||
      previousSnapshot.includeInGpa !== savedSnapshot.includeInGpa ||
      previousSnapshot.hideGpa !== savedSnapshot.hideGpa;
    const draftHasLocalChanges =
      previousSnapshot.name !== draftSnapshot.name ||
      previousSnapshot.alias !== draftSnapshot.alias ||
      previousSnapshot.category !== draftSnapshot.category ||
      previousSnapshot.useCustomColor !== draftSnapshot.useCustomColor ||
      previousSnapshot.color !== draftSnapshot.color ||
      previousSnapshot.credits !== draftSnapshot.credits ||
      previousSnapshot.includeInGpa !== draftSnapshot.includeInGpa ||
      previousSnapshot.hideGpa !== draftSnapshot.hideGpa;
    const incomingMatchesDraft =
      savedSnapshot.name === draftSnapshot.name &&
      savedSnapshot.alias === draftSnapshot.alias &&
      savedSnapshot.category === draftSnapshot.category &&
      savedSnapshot.useCustomColor === draftSnapshot.useCustomColor &&
      savedSnapshot.color === draftSnapshot.color &&
      savedSnapshot.credits === draftSnapshot.credits &&
      savedSnapshot.includeInGpa === draftSnapshot.includeInGpa &&
      savedSnapshot.hideGpa === draftSnapshot.hideGpa;

    lastLoadedSnapshotRef.current = savedSnapshot;
    if (!externalChanged) return;
    if (draftHasLocalChanges && !incomingMatchesDraft) return;

    setName(savedSnapshot.name);
    setAlias(savedSnapshot.alias);
    setCategory(savedSnapshot.category);
    setUseCustomColor(savedSnapshot.useCustomColor);
    setColor(savedSnapshot.color);
    setCredits(savedSnapshot.credits);
    setIncludeInGpa(savedSnapshot.includeInGpa);
    setHideGpa(savedSnapshot.hideGpa);
  }, [draftSnapshot, savedSnapshot]);

  useEffect(() => {
    if (useCustomColor) return;
    setColor(automaticColor);
  }, [automaticColor, useCustomColor]);

  useEffect(() => {
    setLmsSyncEnabled(lmsLink?.sync_enabled ?? true);
  }, [lmsLink?.sync_enabled]);

  useEffect(() => {
    setIsPinnedToHomepage(initialPinnedToHomepage);
  }, [initialPinnedToHomepage]);

  const { flush } = useAutoSave({
    value: draftSnapshot,
    savedValue: savedSnapshot,
    onSave: async (snapshot) => {
      await onSave({
        name: snapshot.name,
        alias: snapshot.alias || null,
        category: snapshot.category || null,
        color: snapshot.useCustomColor ? snapshot.color : null,
        credits: parseFloat(snapshot.credits) || 0,
        include_in_gpa: snapshot.includeInGpa,
        hide_gpa: snapshot.hideGpa,
      });
    },
    onError: (error) => {
      console.error("Failed to save settings", error);
    },
  });

  const flushRef = useRef(flush);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    registerFlush?.(flush);
  }, [flush, registerFlush]);

  useEffect(() => {
    return () => {
      void flushRef.current().catch(() => {});
    };
  }, []);

  const suggestedCategory = useMemo(
    () => resolveCourseSubjectCode({ name, alias: "", category: "" }),
    [name],
  );
  const normalizedCurrentCategory = useMemo(
    () => normalizeSubjectCode(category),
    [category],
  );
  const shouldShowCategoryUpdate = Boolean(
    suggestedCategory && suggestedCategory !== normalizedCurrentCategory,
  );
  const hasLmsLink = Boolean(lmsLink);
  const syncButtonDisabled = !lmsLink || !onSyncCourseLink || isLmsBusy || !lmsSyncEnabled;
  const linkedCourseLabel = lmsLink
    ? `${lmsLink.external_name || lmsLink.external_course_id}${lmsLink.external_course_code ? ` (${lmsLink.external_course_code})` : ""}`
    : "No LMS course linked yet.";
  const linkedProviderIcon = lmsLink ? LMS_PROVIDER_ICONS[lmsLink.provider] : null;
  const relativeLastRefresh = lmsLink?.last_synced_at
    ? formatDistanceToNow(new Date(lmsLink.last_synced_at), { addSuffix: true })
    : null;

  const deferredLinkSearch = useDeferredValue(linkSearch);
  const visibleLmsCourses = useMemo(
    () => availableLmsCourses.filter((c) => c.name.trim().length > 0),
    [availableLmsCourses],
  );
  const linkYearOptions = useMemo(
    () => Array.from(new Set(
      visibleLmsCourses.map(extractLmsCourseYear).filter((y): y is string => y !== null)
    )).sort((a, b) => Number(b) - Number(a)),
    [visibleLmsCourses],
  );
  const linkFilteredCourses = useMemo(() => {
    const q = deferredLinkSearch.trim().toLowerCase();
    return visibleLmsCourses.filter((course) => {
      const courseYear = extractLmsCourseYear(course);
      if (linkYear !== 'all' && courseYear !== linkYear) return false;
      if (!q) return true;
      const haystack = [course.name, course.course_code ?? '', course.external_id, courseYear ?? ''].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [visibleLmsCourses, deferredLinkSearch, linkYear]);

  const handleLinkFromDialog = async (externalCourseId: string) => {
    if (!onLinkCourse) return;
    setIsLmsBusy(true);
    setIsLinkDialogOpen(false);
    try {
      await onLinkCourse({ external_course_id: externalCourseId, sync_enabled: lmsSyncEnabled });
    } finally {
      setIsLmsBusy(false);
    }
  };

  const handleToggleLmsSync = async (nextValue: boolean) => {
    if (!lmsLink || !onSyncCourseLink || isLmsBusy) return;
    const previousValue = lmsSyncEnabled;
    setLmsSyncEnabled(nextValue);
    setIsLmsBusy(true);
    try {
      await onSyncCourseLink({ sync_enabled: nextValue });
    } catch (error) {
      setLmsSyncEnabled(previousValue);
      throw error;
    } finally {
      setIsLmsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection title="General" description="Update the name and key settings.">
        <FieldSet>
          <FieldGroup className="space-y-6">
          <Field>
            <FieldLabel htmlFor={`${fieldId}-name`}>Name</FieldLabel>
            <Input
              id={`${fieldId}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor={`${fieldId}-alias`}>Alias</FieldLabel>
            <Input
              id={`${fieldId}-alias`}
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="e.g. CS101 - Prof. Smith"
            />
            <FieldDescription>Optional short label shown alongside the course name.</FieldDescription>
          </Field>

          <Field>
            <div className="flex min-h-9 items-center justify-between gap-3">
              <FieldLabel htmlFor={`${fieldId}-category`}>Category</FieldLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "transition-opacity",
                  !shouldShowCategoryUpdate && "pointer-events-none opacity-0",
                )}
                onClick={() => {
                  if (!suggestedCategory) return;
                  setCategory(suggestedCategory);
                }}
                aria-hidden={!shouldShowCategoryUpdate}
                tabIndex={shouldShowCategoryUpdate ? 0 : -1}
              >
                Update to {suggestedCategory || "CODE"}
              </Button>
            </div>
            <Input
              id={`${fieldId}-category`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. APS"
            />
            <FieldDescription>Optional subject code used for grouping and default colors.</FieldDescription>
          </Field>

          <FieldGroup className="space-y-6">
            <Field orientation="responsive">
              <FieldContent>
                <FieldLabel htmlFor={`${fieldId}-custom-color`}>Course Color</FieldLabel>
                <FieldDescription>Use a per-course color override instead of the Program default.</FieldDescription>
              </FieldContent>
              <Switch
                id={`${fieldId}-custom-color`}
                checked={useCustomColor}
                onCheckedChange={setUseCustomColor}
                className="shrink-0"
              />
            </Field>

            <Field>
              <div className={cn("transition-opacity", !useCustomColor && "pointer-events-none opacity-55")}>
                <ColorPicker
                  id={`${fieldId}-color`}
                  value={color}
                  onChange={(nextColor) => {
                    setColor(nextColor);
                    setUseCustomColor(true);
                  }}
                  defaultColor={automaticColor}
                  presetColors={COURSE_COLOR_PRESETS}
                  triggerAriaLabel="Choose custom course color"
                  resetLabel="Use Program default color"
                />
              </div>
            </Field>
          </FieldGroup>

          <Field>
            <FieldLabel htmlFor={`${fieldId}-credits`}>Credits</FieldLabel>
            <Input
              id={`${fieldId}-credits`}
              type="number"
              step="0.5"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              required
            />
          </Field>

          <FieldGroup className="space-y-4">
            <Field orientation="responsive">
              <FieldContent>
                <FieldLabel htmlFor={`${fieldId}-include-gpa`}>Include in GPA</FieldLabel>
                <FieldDescription>Use this course when calculating GPA.</FieldDescription>
              </FieldContent>
              <Switch
                id={`${fieldId}-include-gpa`}
                checked={includeInGpa}
                onCheckedChange={setIncludeInGpa}
                className="shrink-0"
              />
            </Field>
            <Field orientation="responsive">
              <FieldContent>
                <FieldLabel htmlFor={`${fieldId}-hide-gpa`}>Hide GPA Info</FieldLabel>
                <FieldDescription>Hide GPA details in course-level views.</FieldDescription>
              </FieldContent>
              <Switch
                id={`${fieldId}-hide-gpa`}
                checked={hideGpa}
                onCheckedChange={setHideGpa}
                className="shrink-0"
              />
            </Field>
          </FieldGroup>
          </FieldGroup>
        </FieldSet>
      </SettingsSection>

      <SettingsSection title="LMS" description="Link this course to an external LMS course and refresh its read-only LMS data.">
        <FieldSet>
          <FieldGroup className="space-y-6">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-col gap-0">
                {/* Info row — always same height */}
                <div className="flex min-h-[52px] items-center gap-3">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {linkedProviderIcon ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border/70 bg-background p-0.5">
                          <img
                            src={linkedProviderIcon.src}
                            alt={linkedProviderIcon.alt}
                            className="h-3.5 w-3.5 object-contain"
                          />
                        </span>
                      ) : null}
                      <span className="min-w-0 truncate">{linkedCourseLabel}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {!lmsIntegrationEnabled
                        ? "Set up an LMS integration in Program settings first."
                        : lmsLink?.last_error?.message
                          ? lmsLink.last_error.message
                          : relativeLastRefresh
                            ? `Last refreshed ${relativeLastRefresh}`
                            : "Sync assignments and events from your LMS."}
                    </p>
                  </div>
                </div>

                {/* Action row — always rendered, content switches per state */}
                <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 mt-3">
                  {hasLmsLink ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!lmsIntegrationEnabled || availableLmsCourses.length === 0 || isLmsBusy}
                        onClick={() => setIsLinkDialogOpen(true)}
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Change
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={syncButtonDisabled}
                        onClick={async () => {
                          if (!onSyncCourseLink) return;
                          setIsLmsBusy(true);
                          try {
                            await onSyncCourseLink({ sync_enabled: lmsSyncEnabled });
                          } finally {
                            setIsLmsBusy(false);
                          }
                        }}
                      >
                        <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isLmsBusy && "animate-spin")} />
                        Sync Now
                      </Button>
                      {lmsLink?.last_error?.message ? (
                        <Badge variant="outline" className="text-destructive">Sync issue</Badge>
                      ) : null}
                      {!lmsSyncEnabled ? (
                        <Badge variant="outline">Sync off</Badge>
                      ) : null}
                      <div className="ml-auto">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={!onUnlinkCourse || isLmsBusy}
                            >
                              <Unplug className="mr-2 h-3.5 w-3.5" />
                              Disconnect
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent size="sm">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Disconnect LMS course?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This course will keep its local data, but LMS assignments and calendar events will stop refreshing until you link it again.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isLmsBusy}>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                disabled={isLmsBusy}
                                onClick={async () => {
                                  if (!onUnlinkCourse) return;
                                  setIsLmsBusy(true);
                                  try {
                                    await onUnlinkCourse();
                                  } finally {
                                    setIsLmsBusy(false);
                                  }
                                }}
                              >
                                Disconnect
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={!lmsIntegrationEnabled || availableLmsCourses.length === 0 || isLmsBusy}
                      onClick={() => setIsLinkDialogOpen(true)}
                    >
                      <Link2 className="mr-2 h-3.5 w-3.5" />
                      Link LMS Course
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Field orientation="responsive">
              <FieldContent>
                <FieldLabel htmlFor={`${fieldId}-lms-sync-enabled`}>Keep LMS data refreshed</FieldLabel>
                <FieldDescription>
                  Turn this off to keep the link but stop LMS refreshes for this course.
                </FieldDescription>
              </FieldContent>
              <Switch
                id={`${fieldId}-lms-sync-enabled`}
                checked={lmsSyncEnabled}
                onCheckedChange={(checked) => void handleToggleLmsSync(checked)}
                disabled={isLmsBusy || !lmsLink || !onSyncCourseLink}
              />
            </Field>
          </FieldGroup>
        </FieldSet>
      </SettingsSection>

      <SettingsSection title="Program Home" description="Control whether this Course stays visible on Program Home.">
        <FieldSet>
          <FieldGroup className="space-y-6">
            <Field orientation="responsive">
              <FieldContent>
                <FieldLabel htmlFor={`${fieldId}-pin-homepage`}>Pin to Homepage</FieldLabel>
                <FieldDescription>Keep this Course in the Program Home Focus Board.</FieldDescription>
              </FieldContent>
              <Switch
                id={`${fieldId}-pin-homepage`}
                checked={isPinnedToHomepage}
                onCheckedChange={(nextValue) => {
                  if (!onTogglePinnedToHomepage) {
                    setIsPinnedToHomepage(nextValue);
                    return;
                  }
                  if (nextValue) {
                    setIsPinnedToHomepage(true);
                    void onTogglePinnedToHomepage(true);
                    return;
                  }
                  setIsConfirmingUnpin(true);
                }}
                className="shrink-0"
              />
            </Field>
          </FieldGroup>
        </FieldSet>
      </SettingsSection>

      <ResponsiveDialogDrawer
        open={isLinkDialogOpen}
        onOpenChange={(open) => {
          setIsLinkDialogOpen(open);
          if (!open) {
            setLinkSearch('');
            setLinkYear('all');
          }
        }}
        title={hasLmsLink ? "Change Linked LMS Course" : "Link LMS Course"}
        desktopContentClassName="flex h-[560px] flex-col overflow-hidden sm:max-w-lg"
        mobileContentClassName="flex h-[80vh] max-h-[80vh] flex-col overflow-hidden"
        footer={
          <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
            Cancel
          </Button>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid flex-none gap-3 sm:grid-cols-[1fr_9rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search LMS courses..."
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={linkYear} onValueChange={setLinkYear}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All years" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All years</SelectItem>
                  {linkYearOptions.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {visibleLmsCourses.length === 0 ? (
              <div className="flex h-full min-h-[200px] items-center justify-center">
                <AppEmptyState
                  scenario="unavailable"
                  size="modal"
                  surface="inherit"
                  title="No LMS courses found"
                  description="This program has no available LMS courses."
                />
              </div>
            ) : linkFilteredCourses.length === 0 ? (
              <div className="flex h-full min-h-[200px] items-center justify-center">
                <AppEmptyState
                  scenario="no-results"
                  size="modal"
                  surface="inherit"
                  title="No matching courses"
                  description="Try a different keyword or year."
                />
              </div>
            ) : (
              <ScrollArea className="h-full min-h-0 min-w-0">
                <div className="grid min-w-0 gap-2 px-1.5 py-1 pr-5">
                  {linkFilteredCourses.map((course) => {
                    const isLinked = course.external_id === lmsLink?.external_course_id;
                    const courseCode = course.course_code || course.external_id;
                    const courseYear = extractLmsCourseYear(course);
                    return (
                      <Card
                        key={course.external_id}
                        size="sm"
                        className={cn(
                          "py-0 transition-colors",
                          isLinked ? "bg-accent/30" : "hover:bg-accent/20",
                        )}
                      >
                        <div className="flex items-start gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <p className="truncate text-sm font-medium">{course.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {courseCode}{courseYear ? ` · ${courseYear}` : ''}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={isLinked || isLmsBusy}
                            onClick={isLinked ? undefined : () => void handleLinkFromDialog(course.external_id)}
                          >
                            {isLinked ? "Linked" : "Link"}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </ResponsiveDialogDrawer>

      <AlertDialog open={isConfirmingUnpin} onOpenChange={setIsConfirmingUnpin}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this Course from Program Home?</AlertDialogTitle>
            <AlertDialogDescription>
              This only removes the pin from Program Home. The Course itself will stay unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setIsPinnedToHomepage(false);
                setIsConfirmingUnpin(false);
                void onTogglePinnedToHomepage?.(false);
              }}
            >
              Remove Pin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
