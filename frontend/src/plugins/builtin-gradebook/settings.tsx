// input:  [course/program gradebook APIs, app-side Program query wiring, plugin settings section contracts, shared gradebook/category helpers, and shared data-table row-actions dropdown helpers]
// output: [builtin-gradebook shared settings sections for Program defaults plus course-level forecast/category management]
// pos:    [gradebook settings surface that exposes Program-scoped defaults through plugin tab settings and course-scoped live gradebook management through the persisted gradebook APIs]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { definePluginSettings } from '@/plugin-sdk';
import { getProgramDetailQueryOptions, invalidateProgramDetailQuery } from '@/data/resources';
import { useCourseGradebookMutation, useCourseGradebookQuery } from '@/hooks/useCourseGradebookQuery';
import type { PluginSettingsSectionProps } from '@/plugin-sdk';
import api, { type CourseGradebook, type GradebookAssessmentCategory } from '@/services/api';

import { SettingsSection } from '@/components/SettingsSection';
import { TabSettingSourceHint } from '@/components/settings/TabSettingSourceHint';
import { DataTable, DataTableActionMenu } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ColorPicker, type ColorPickerPreset } from '@/components/ui/color-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TableHead, TableRow, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { getSettingSource } from '@/plugin-system/tabSettingsMeta';
import {
    BUILTIN_GRADEBOOK_TAB_TYPE,
    CATEGORY_COLOR_OPTIONS,
    DEFAULT_GRADEBOOK_DEFAULTS_SETTINGS,
    getApiErrorMessage,
    normalizeGradebookDefaultsSettings,
    type GradebookDefaultCategoryTemplate,
} from './shared';

// ── colour helpers ────────────────────────────────────────────────────────────

const CATEGORY_COLOR_PRESETS: readonly ColorPickerPreset[] = [
    { name: 'Emerald', value: '#10b981' },
    { name: 'Blue',    value: '#3b82f6' },
    { name: 'Amber',   value: '#f59e0b' },
    { name: 'Violet',  value: '#8b5cf6' },
    { name: 'Rose',    value: '#f43f5e' },
    { name: 'Slate',   value: '#64748b' },
    { name: 'Cyan',    value: '#06b6d4' },
];

const DEFAULT_CATEGORY_COLOR = CATEGORY_COLOR_PRESETS[0].value;

const IS_HEX = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);

const getCategorySwatchStyle = (
    colorToken: string | null | undefined,
): { className?: string; style?: React.CSSProperties } => {
    if (colorToken && IS_HEX(colorToken)) {
        return { style: { backgroundColor: colorToken } };
    }
    const named = CATEGORY_COLOR_OPTIONS.find((o) => o.value === colorToken);
    return { className: named?.swatchClassName ?? CATEGORY_COLOR_OPTIONS[CATEGORY_COLOR_OPTIONS.length - 1].swatchClassName };
};

const FORECAST_MODEL_OPTIONS = [
    {
        value: 'auto',
        label: 'Auto',
        description: 'Project each remaining category from its released scores when history exists.',
    },
    {
        value: 'simple_minimum_needed',
        label: 'Simple minimum needed',
        description: 'Skip category modeling and focus on the average you still need across remaining weight.',
    },
] as const;

// ── CategoryFormDialog ────────────────────────────────────────────────────────

interface CategoryFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: Pick<GradebookAssessmentCategory, 'name' | 'color_token'> | null;
    onSubmit: (name: string, colorToken: string) => Promise<void>;
}

const CategoryFormDialog: React.FC<CategoryFormDialogProps> = ({
    open,
    onOpenChange,
    initialData,
    onSubmit,
}) => {
    const [name, setName] = useState('');
    const [color, setColor] = useState(DEFAULT_CATEGORY_COLOR);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            if (initialData) {
                setName(initialData.name);
                // Resolve a legacy named token to its hex equivalent so the picker
                // renders a meaningful swatch; fall back to default if unrecognised.
                const legacyHex = CATEGORY_COLOR_PRESETS.find(
                    (p) => p.name.toLowerCase() === initialData.color_token?.toLowerCase()
                )?.value;
                setColor(IS_HEX(initialData.color_token ?? '') ? initialData.color_token! : (legacyHex ?? DEFAULT_CATEGORY_COLOR));
            } else {
                setName('');
                setColor(DEFAULT_CATEGORY_COLOR);
            }
        }
    }, [open, initialData]);

    const handleSubmit = async () => {
        if (!name.trim()) return;
        setIsSubmitting(true);
        try {
            await onSubmit(name.trim(), color);
            onOpenChange(false);
        } catch {
            // errors are handled by the caller (commitGradebook)
        } finally {
            setIsSubmitting(false);
        }
    };

    const isEdit = Boolean(initialData);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Edit Category' : 'Create Category'}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? 'Update the name or colour of this category.'
                            : 'Add a new grouping for your assessments.'}
                    </DialogDescription>
                </DialogHeader>

                <FieldSet className="pt-2">
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="cat-name">Name</FieldLabel>
                            <Input
                                id="cat-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Homework"
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSubmit(); } }}
                                autoFocus
                            />
                        </Field>

                        <Field>
                            <FieldLabel>Colour</FieldLabel>
                            <FieldDescription>Choose the default color used for this assessment category.</FieldDescription>
                            <ColorPicker
                                value={color}
                                onChange={setColor}
                                presetColors={CATEGORY_COLOR_PRESETS}
                                triggerAriaLabel="Choose category colour"
                            />
                        </Field>
                    </FieldGroup>
                </FieldSet>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={!name.trim() || isSubmitting}
                    >
                        {isEdit ? 'Save Changes' : 'Create Category'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const GradebookDefaultsSettings: React.FC<PluginSettingsSectionProps> = ({
    scope,
    onRefresh,
}) => {
    const queryClient = useQueryClient();
    const programId = scope.kind === 'program' ? scope.programId : undefined;
    const programQuery = useQuery({
        ...getProgramDetailQueryOptions(programId ?? '__missing__'),
        enabled: Boolean(programId),
    });
    const [isMutating, setIsMutating] = useState(false);
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
    const [pendingDeleteCategoryIndex, setPendingDeleteCategoryIndex] = useState<number | null>(null);

    const defaults = React.useMemo(() => {
        if (!programQuery.data?.tab_settings) {
            return DEFAULT_GRADEBOOK_DEFAULTS_SETTINGS;
        }
        const tabSetting = programQuery.data.tab_settings.find((entry) => entry.tab_type === BUILTIN_GRADEBOOK_TAB_TYPE);
        if (!tabSetting) {
            return DEFAULT_GRADEBOOK_DEFAULTS_SETTINGS;
        }
        return normalizeGradebookDefaultsSettings(tabSetting.resolved_settings ?? tabSetting.settings);
    }, [programQuery.data?.tab_settings]);
    const gradebookTabSetting = React.useMemo(() => {
        if (!programQuery.data?.tab_settings) {
            return null;
        }
        return programQuery.data.tab_settings.find((entry) => entry.tab_type === BUILTIN_GRADEBOOK_TAB_TYPE) ?? null;
    }, [programQuery.data?.tab_settings]);
    const gradebookSettingsMeta = React.useMemo(() => {
        if (!gradebookTabSetting) {
            return undefined;
        }
        return {
            scopeSettings: gradebookTabSetting.scope_settings ?? {},
            inheritedSettings: gradebookTabSetting.inherited_settings ?? {},
            settingSources: gradebookTabSetting.setting_sources ?? {},
        };
    }, [gradebookTabSetting]);
    const forecastSource = React.useMemo(() => getSettingSource(gradebookSettingsMeta, 'forecast_model'), [gradebookSettingsMeta]);
    const categoriesSource = React.useMemo(() => getSettingSource(gradebookSettingsMeta, 'categories'), [gradebookSettingsMeta]);

    const editingCategory = editingCategoryIndex !== null
        ? (defaults.categories[editingCategoryIndex] ?? null)
        : null;
    const pendingDeleteCategory = pendingDeleteCategoryIndex !== null
        ? (defaults.categories[pendingDeleteCategoryIndex] ?? null)
        : null;

    const saveDefaults = useCallback(async (nextDefaults: { forecast_model: CourseGradebook['forecast_model']; categories: GradebookDefaultCategoryTemplate[] }) => {
        if (!programId) return;
        setIsMutating(true);
        try {
            await api.updateProgramTabSettings(programId, BUILTIN_GRADEBOOK_TAB_TYPE, {
                settings: JSON.stringify(nextDefaults),
            });
            await invalidateProgramDetailQuery(queryClient, programId);
            onRefresh();
        } catch (error: unknown) {
            console.error('Failed to update gradebook defaults', error);
            toast.error(getApiErrorMessage(error));
        } finally {
            setIsMutating(false);
        }
    }, [onRefresh, programId, queryClient]);

    const handleOpenCreate = useCallback(() => {
        setEditingCategoryIndex(null);
        setCategoryDialogOpen(true);
    }, []);

    const handleOpenEdit = useCallback((index: number) => {
        setEditingCategoryIndex(index);
        setCategoryDialogOpen(true);
    }, []);

    const handleCategorySubmit = useCallback(async (name: string, colorToken: string) => {
        const nextCategories = [...defaults.categories];
        const duplicateIndex = nextCategories.findIndex((category, index) => (
            category.name.trim().toLowerCase() === name.trim().toLowerCase()
            && index !== editingCategoryIndex
        ));
        if (duplicateIndex >= 0) {
            toast.error('Category names must be unique.');
            return;
        }

        if (editingCategoryIndex !== null && nextCategories[editingCategoryIndex]) {
            nextCategories[editingCategoryIndex] = { name, color_token: colorToken };
        } else {
            nextCategories.push({ name, color_token: colorToken });
        }

        await saveDefaults({
            ...defaults,
            categories: nextCategories,
        });
    }, [defaults, editingCategoryIndex, saveDefaults]);

    if (!programId) return null;

    if (programQuery.isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-48 w-full rounded-2xl" />
                <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <SettingsSection
                title={(
                    <span className="inline-flex flex-wrap items-center gap-2">
                        <span>Forecast</span>
                        <TabSettingSourceHint
                            source={forecastSource}
                            onReset={async () => {
                                const nextSettings = {
                                    ...(gradebookTabSetting?.scope_settings ?? {}),
                                };
                                delete nextSettings.forecast_model;
                                await saveDefaults(normalizeGradebookDefaultsSettings(nextSettings));
                            }}
                        />
                    </span>
                )}
                description="Choose the default forecast model newly initialized course gradebooks should start with."
            >
                <div className="space-y-4">
                    <RadioGroup
                        value={defaults.forecast_model}
                        onValueChange={(value) => {
                            void saveDefaults({
                                ...defaults,
                                forecast_model: value as CourseGradebook['forecast_model'],
                            });
                        }}
                        className="space-y-3"
                    >
                        {FORECAST_MODEL_OPTIONS.map((option) => {
                            const id = `gradebook-default-forecast-model-${option.value}`;
                            const isSelected = defaults.forecast_model === option.value;
                            return (
                                <label
                                    key={option.value}
                                    htmlFor={id}
                                    className={cn(
                                        'flex cursor-pointer items-start justify-between gap-4 rounded-xl border px-4 py-3 transition-colors',
                                        isSelected ? 'border-primary/60 bg-primary/5' : 'border-border/60',
                                        isMutating && 'cursor-wait opacity-70',
                                    )}
                                >
                                    <div className="space-y-1">
                                        <div className="text-sm font-medium text-foreground">{option.label}</div>
                                        <p className="text-sm text-muted-foreground">{option.description}</p>
                                    </div>
                                    <RadioGroupItem
                                        id={id}
                                        value={option.value}
                                        aria-label={option.label}
                                        disabled={isMutating}
                                        className="mt-0.5 shrink-0"
                                    />
                                </label>
                            );
                        })}
                    </RadioGroup>

                    <p className="text-sm text-muted-foreground">
                        These defaults apply when a course creates its gradebook for the first time. Existing courses keep their own saved gradebook state.
                    </p>
                </div>
            </SettingsSection>

            <SettingsSection
                title={(
                    <span className="inline-flex flex-wrap items-center gap-2">
                        <span>Categories</span>
                        <TabSettingSourceHint
                            source={categoriesSource}
                            onReset={async () => {
                                const nextSettings = {
                                    ...(gradebookTabSetting?.scope_settings ?? {}),
                                };
                                delete nextSettings.categories;
                                await saveDefaults(normalizeGradebookDefaultsSettings(nextSettings));
                            }}
                        />
                    </span>
                )}
                description="Define the default categories newly initialized course gradebooks should receive."
            >
                <DataTable
                    title="Default Categories"
                    description="These category templates seed new course gradebooks in this Program."
                    items={defaults.categories}
                    minWidthClassName="min-w-[26rem] sm:min-w-[30rem]"
                    actionButton={(
                        <Button onClick={handleOpenCreate} disabled={isMutating}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Category
                        </Button>
                    )}
                    renderHeader={() => (
                        <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    )}
                    renderRow={(category, index) => {
                        const swatchProps = getCategorySwatchStyle(category.color_token);
                        return (
                            <TableRow key={`${category.name}:${index}`}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={cn('inline-block h-3 w-3 shrink-0 rounded-full border border-border/50', swatchProps.className)}
                                            style={swatchProps.style}
                                        />
                                        <span className="text-sm">{category.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end">
                                        <DataTableActionMenu triggerLabel={`Open actions for ${category.name}`}>
                                            <DropdownMenuItem
                                                disabled={isMutating}
                                                onClick={() => handleOpenEdit(index)}
                                            >
                                                <Edit className="h-4 w-4" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                variant="destructive"
                                                disabled={isMutating}
                                                onClick={() => setPendingDeleteCategoryIndex(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DataTableActionMenu>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    }}
                />
                <AlertDialog open={pendingDeleteCategoryIndex !== null} onOpenChange={(open) => !open && setPendingDeleteCategoryIndex(null)}>
                    <AlertDialogContent size="sm">
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {pendingDeleteCategory ? `Delete category "${pendingDeleteCategory.name}"?` : 'Delete category?'}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Newly created course gradebooks will stop receiving this default category. Existing course categories are not changed.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                variant="destructive"
                                onClick={() => {
                                    if (pendingDeleteCategoryIndex === null) return;
                                    const nextCategories = defaults.categories.filter((_, index) => index !== pendingDeleteCategoryIndex);
                                    void saveDefaults({
                                        ...defaults,
                                        categories: nextCategories,
                                    });
                                    setPendingDeleteCategoryIndex(null);
                                }}
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </SettingsSection>

            <CategoryFormDialog
                open={categoryDialogOpen}
                onOpenChange={setCategoryDialogOpen}
                initialData={editingCategory}
                onSubmit={handleCategorySubmit}
            />
        </div>
    );
};

// ── GradebookSettings ─────────────────────────────────────────────────────────

const CourseGradebookSettings: React.FC<PluginSettingsSectionProps> = ({
    scope,
    onRefresh,
}) => {
    const courseId = scope.kind === 'course' ? scope.courseId : undefined;
    const [isMutating, setIsMutating] = useState(false);
    const gradebookQuery = useCourseGradebookQuery(courseId);
    const gradebookMutation = useCourseGradebookMutation(courseId);
    const gradebook = gradebookQuery.data ?? null;

    // category dialog state
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<GradebookAssessmentCategory | null>(null);
    const [pendingDeleteCategory, setPendingDeleteCategory] = useState<GradebookAssessmentCategory | null>(null);

    /** Commits a gradebook mutation and refreshes the host settings shell after success. */
    const commitGradebook = useCallback(async (promise: Promise<CourseGradebook>) => {
        setIsMutating(true);
        try {
            await gradebookMutation.mutateAsync(() => promise);
            onRefresh();
        } catch (error: unknown) {
            console.error('Failed to update gradebook', error);
            toast.error(getApiErrorMessage(error));
        } finally {
            setIsMutating(false);
        }
    }, [gradebookMutation, onRefresh]);

    const handleOpenCreate = useCallback(() => {
        setEditingCategory(null);
        setCategoryDialogOpen(true);
    }, []);

    const handleOpenEdit = useCallback((category: GradebookAssessmentCategory) => {
        setEditingCategory(category);
        setCategoryDialogOpen(true);
    }, []);

    const handleCategorySubmit = useCallback(async (name: string, colorToken: string) => {
        if (!gradebook || !courseId) return;
        if (editingCategory) {
            await commitGradebook(api.updateCourseGradebookCategory(courseId, editingCategory.id, {
                name,
                color_token: colorToken,
            }));
        } else {
            await commitGradebook(api.createCourseGradebookCategory(courseId, {
                name,
                color_token: colorToken,
            }));
        }
    }, [commitGradebook, courseId, editingCategory, gradebook]);

    if (!courseId) return null;

    if (gradebookQuery.isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-48 w-full rounded-2xl" />
                <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
        );
    }

    if (!gradebook) {
        return <div className="text-sm text-destructive">Failed to load gradebook data.</div>;
    }

    return (
        <div className="space-y-6">
            <SettingsSection title="Forecast" description="Choose how the Gradebook tab projects outcomes and powers Plan mode recommendations.">
                <div className="space-y-4">
                    <RadioGroup
                        value={gradebook.forecast_model}
                        onValueChange={(value) => void commitGradebook(api.updateCourseGradebookPreferences(courseId, {
                            forecast_model: value as CourseGradebook['forecast_model'],
                        }))}
                        className="space-y-3"
                    >
                        {FORECAST_MODEL_OPTIONS.map((option) => {
                            const id = `gradebook-forecast-model-${option.value}`;
                            const isSelected = gradebook.forecast_model === option.value;
                            return (
                                <label
                                    key={option.value}
                                    htmlFor={id}
                                    className={cn(
                                        'flex cursor-pointer items-start justify-between gap-4 rounded-xl border px-4 py-3 transition-colors',
                                        isSelected ? 'border-primary/60 bg-primary/5' : 'border-border/60',
                                        isMutating && 'cursor-wait opacity-70',
                                    )}
                                >
                                    <div className="space-y-1">
                                        <div className="text-sm font-medium text-foreground">{option.label}</div>
                                        <p className="text-sm text-muted-foreground">{option.description}</p>
                                    </div>
                                    <RadioGroupItem
                                        id={id}
                                        value={option.value}
                                        aria-label={option.label}
                                        disabled={isMutating}
                                        className="mt-0.5 shrink-0"
                                    />
                                </label>
                            );
                        })}
                    </RadioGroup>

                    <p className="text-sm text-muted-foreground">
                        Auto is best when you already have some released grades in each remaining category. Use Simple minimum needed when you only want a target-based requirement without category assumptions.
                    </p>
                </div>
            </SettingsSection>

            <SettingsSection title="Categories" description="Organize the assessment labels used by the table and forecast model.">
                <DataTable
                    title="Categories"
                    description="Manage the category labels available to this course."
                    items={gradebook.categories}
                    minWidthClassName="min-w-[26rem] sm:min-w-[30rem]"
                    actionButton={(
                        <Button onClick={handleOpenCreate}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Category
                        </Button>
                    )}
                    renderHeader={() => (
                        <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    )}
                    renderRow={(category) => {
                        const swatchProps = getCategorySwatchStyle(category.color_token);
                        return (
                            <TableRow key={category.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={cn('inline-block h-3 w-3 shrink-0 rounded-full border border-border/50', swatchProps.className)}
                                            style={swatchProps.style}
                                        />
                                        <span className="text-sm">{category.name}</span>
                                    </div>
                                </TableCell>

                                <TableCell className="text-right">
                                    <div className="flex justify-end">
                                        <DataTableActionMenu triggerLabel={`Open actions for ${category.name}`}>
                                            <DropdownMenuItem
                                                disabled={isMutating}
                                                onClick={() => handleOpenEdit(category)}
                                            >
                                                <Edit className="h-4 w-4" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                variant="destructive"
                                                disabled={isMutating}
                                                onClick={() => setPendingDeleteCategory(category)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DataTableActionMenu>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    }}
                />
                <AlertDialog open={pendingDeleteCategory !== null} onOpenChange={(open) => !open && setPendingDeleteCategory(null)}>
                    <AlertDialogContent size="sm">
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {pendingDeleteCategory ? `Delete category "${pendingDeleteCategory.name}"?` : 'Delete category?'}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. Assessments in this category will become uncategorized.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                variant="destructive"
                                onClick={() => {
                                    if (!pendingDeleteCategory) return;
                                    void commitGradebook(api.deleteCourseGradebookCategory(courseId, pendingDeleteCategory.id));
                                    setPendingDeleteCategory(null);
                                }}
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </SettingsSection>

            {/* ── Category form dialog (shared create / edit) ─────────────── */}
            <CategoryFormDialog
                open={categoryDialogOpen}
                onOpenChange={setCategoryDialogOpen}
                initialData={editingCategory}
                onSubmit={handleCategorySubmit}
            />
        </div>
    );
};

export default definePluginSettings({
    pluginSettings: [
        {
            id: 'gradebook-defaults',
            component: GradebookDefaultsSettings,
            allowedContexts: ['program'],
        },
        {
            id: 'gradebook-forecast-and-categories',
            component: CourseGradebookSettings,
            allowedContexts: ['course'],
        },
    ],
});
