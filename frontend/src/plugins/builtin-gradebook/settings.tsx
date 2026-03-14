// input:  [course gradebook APIs, plugin settings contracts, and shared category helpers]
// output: [builtin-gradebook shared settings sections for forecast preferences and categories]
// pos:    [course-scoped gradebook settings surface for forecast-mode selection, Field-based category dialog inputs, and category management]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useState, useEffect, useCallback } from 'react';
import { Edit, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { definePluginSettings } from '@/plugin-system/contracts';
import { useCourseGradebookMutation, useCourseGradebookQuery } from '@/hooks/useCourseGradebookQuery';
import type { PluginSettingsProps } from '@/services/pluginSettingsRegistry';
import api, { type CourseGradebook, type GradebookAssessmentCategory } from '@/services/api';

import { SettingsSection } from '@/components/SettingsSection';
import { CrudPanel } from '@/components/CrudPanel';
import { Button } from '@/components/ui/button';
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
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { TableHead, TableRow, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CATEGORY_COLOR_OPTIONS, getApiErrorMessage } from './shared';

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
    initialData?: GradebookAssessmentCategory | null;
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

// ── GradebookSettings ─────────────────────────────────────────────────────────

const GradebookSettings: React.FC<PluginSettingsProps> = ({
    courseId,
    onRefresh,
}) => {
    const [isMutating, setIsMutating] = useState(false);
    const gradebookQuery = useCourseGradebookQuery(courseId);
    const gradebookMutation = useCourseGradebookMutation(courseId);
    const gradebook = gradebookQuery.data ?? null;

    // category dialog state
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<GradebookAssessmentCategory | null>(null);

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
                <CrudPanel
                    title="Categories"
                    description="Manage the category labels available to this course."
                    minWidthClassName="min-w-[480px]"
                    items={gradebook.categories}
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
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Edit category ${category.name}`}
                                            onClick={() => handleOpenEdit(category)}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="icon"
                                                    aria-label={`Delete category ${category.name}`}
                                                    disabled={isMutating}
                                                ><Trash2 className="h-4 w-4" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent size="sm">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete category "{category.name}"?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action cannot be undone. Assessments in this category will become uncategorized.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        variant="destructive"
                                                        onClick={() => void commitGradebook(
                                                            api.deleteCourseGradebookCategory(courseId, category.id)
                                                        )}
                                                    >Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    }}
                />
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
            id: 'gradebook-forecast-and-categories',
            component: GradebookSettings,
            allowedContexts: ['course'],
        },
    ],
});
