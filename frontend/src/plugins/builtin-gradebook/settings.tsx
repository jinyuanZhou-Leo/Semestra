import React, { useState, useEffect, useCallback } from 'react';
import { Edit, Star, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { definePluginSettings } from '@/plugin-system/contracts';
import type { PluginSettingsProps } from '@/services/pluginSettingsRegistry';
import api, { type CourseGradebook, type GradebookAssessmentCategory } from '@/services/api';

import { SettingsSection } from '@/components/SettingsSection';
import { CrudPanel } from '@/components/CrudPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { ColorPicker, type ColorPickerPreset } from '@/components/ui/color-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { getScenarioSwatchClassName, CATEGORY_COLOR_OPTIONS, getApiErrorMessage } from './shared';

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

                <div className="grid gap-4 pt-2">
                    <div className="space-y-2">
                        <Label htmlFor="cat-name">Name</Label>
                        <Input
                            id="cat-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Homework"
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSubmit(); } }}
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Colour</Label>
                        <ColorPicker
                            value={color}
                            onChange={setColor}
                            presetColors={CATEGORY_COLOR_PRESETS}
                            triggerAriaLabel="Choose category colour"
                        />
                    </div>
                </div>

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
    const [gradebook, setGradebook] = useState<CourseGradebook | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);

    // scenario state
    const [newScenarioName, setNewScenarioName] = useState('');
    const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
    const [editingScenarioName, setEditingScenarioName] = useState('');

    // category dialog state
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<GradebookAssessmentCategory | null>(null);

    const loadGradebook = useCallback(async () => {
        if (!courseId) return;
        setIsLoading(true);
        try {
            const response = await api.getCourseGradebook(courseId);
            setGradebook(response);
        } catch (error) {
            console.error('Failed to load gradebook settings', error);
        } finally {
            setIsLoading(false);
        }
    }, [courseId]);

    useEffect(() => {
        void loadGradebook();
    }, [loadGradebook]);

    /** Commits a gradebook mutation; only shows a toast on error. */
    const commitGradebook = useCallback(async (promise: Promise<CourseGradebook>) => {
        setIsMutating(true);
        try {
            const response = await promise;
            setGradebook(response);
            onRefresh();
        } catch (error: unknown) {
            console.error('Failed to update gradebook', error);
            if (
                typeof error === 'object' &&
                error !== null &&
                'response' in error &&
                (error as { response?: { status?: number } }).response?.status === 409
            ) {
                toast.error('Gradebook revision conflict. Reloading the latest data.');
                await loadGradebook();
                return;
            }
            toast.error(getApiErrorMessage(error));
        } finally {
            setIsMutating(false);
        }
    }, [loadGradebook, onRefresh]);

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
                revision: gradebook.revision,
                name,
                color_token: colorToken,
            }));
        } else {
            await commitGradebook(api.createCourseGradebookCategory(courseId, {
                revision: gradebook.revision,
                name,
                color_token: colorToken,
            }));
        }
    }, [commitGradebook, courseId, editingCategory, gradebook]);

    if (!courseId) return null;

    if (isLoading) {
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

            {/* ── Scenarios ──────────────────────────────────────────────── */}
            <SettingsSection title="Scenarios" description="Manage grading prediction scenarios and baseline status.">
                <div className="space-y-4">
                    {gradebook.scenarios.map(scenario => (
                        <div key={scenario.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                {editingScenarioId === scenario.id ? (
                                    <Input
                                        value={editingScenarioName}
                                        onChange={(e) => setEditingScenarioName(e.target.value)}
                                        className="h-8 max-w-[200px]"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                void commitGradebook(api.updateCourseGradebookScenario(courseId, scenario.id, {
                                                    revision: gradebook.revision,
                                                    name: editingScenarioName.trim(),
                                                }));
                                                setEditingScenarioId(null);
                                                setEditingScenarioName('');
                                            }
                                        }}
                                        autoFocus
                                    />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className={cn('h-2.5 w-2.5 rounded-full', getScenarioSwatchClassName(scenario.color_token))} />
                                        <span className="text-sm font-medium text-foreground">{scenario.name}</span>
                                    </div>
                                )}
                                {scenario.is_baseline && (
                                    <Badge variant="secondary" className="h-5 rounded-sm px-1.5 text-[10px] uppercase tracking-wider">
                                        Baseline
                                    </Badge>
                                )}
                            </div>

                            <div className="flex items-center gap-1 sm:justify-end">
                                {editingScenarioId === scenario.id ? (
                                    <Button
                                        type="button" size="sm" variant="ghost" disabled={isMutating}
                                        onClick={() => {
                                            void commitGradebook(api.updateCourseGradebookScenario(courseId, scenario.id, {
                                                revision: gradebook.revision,
                                                name: editingScenarioName.trim(),
                                            }));
                                            setEditingScenarioId(null);
                                            setEditingScenarioName('');
                                        }}
                                    >
                                        Save
                                    </Button>
                                ) : (
                                    <Button
                                        type="button" size="icon" variant="ghost" disabled={isMutating}
                                        onClick={() => {
                                            setEditingScenarioId(scenario.id);
                                            setEditingScenarioName(scenario.name);
                                        }}
                                    ><Edit className="h-4 w-4" /></Button>
                                )}

                                {!scenario.is_baseline && (
                                    <Button
                                        type="button" size="icon" variant="ghost" disabled={isMutating}
                                        onClick={() => void commitGradebook(api.updateCourseGradebookScenario(courseId, scenario.id, {
                                            revision: gradebook.revision,
                                            is_baseline: true,
                                        }))}
                                    ><Star className="h-4 w-4 text-muted-foreground hover:text-foreground" /></Button>
                                )}

                                {gradebook.scenarios.length > 1 && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                type="button" size="icon" variant="ghost"
                                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                disabled={isMutating}
                                            ><Trash2 className="h-4 w-4" /></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent size="sm">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete scenario "{scenario.name}"?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This action cannot be undone. All forecast data for this scenario will be lost.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    variant="destructive"
                                                    onClick={() => void commitGradebook(
                                                        api.deleteCourseGradebookScenario(courseId, scenario.id, { revision: gradebook.revision })
                                                    )}
                                                >Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <Separator className="my-4" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                        <span className="text-sm font-medium">Add Scenario</span>
                        <p className="text-sm text-muted-foreground">Create a new projection track.</p>
                    </div>
                    <div className="flex w-full sm:w-auto items-center gap-2">
                        <Input
                            value={newScenarioName}
                            onChange={(e) => setNewScenarioName(e.target.value)}
                            placeholder="Expected +5"
                            className="h-9 w-full sm:w-[160px]"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && newScenarioName.trim()) {
                                    void commitGradebook(api.createCourseGradebookScenario(courseId, {
                                        revision: gradebook.revision,
                                        name: newScenarioName.trim(),
                                        color_token: CATEGORY_COLOR_OPTIONS[(gradebook.scenarios.length + 1) % CATEGORY_COLOR_OPTIONS.length].value,
                                    }));
                                    setNewScenarioName('');
                                }
                            }}
                        />
                        <Button
                            type="button" size="sm" disabled={isMutating || !newScenarioName.trim()}
                            onClick={() => {
                                void commitGradebook(api.createCourseGradebookScenario(courseId, {
                                    revision: gradebook.revision,
                                    name: newScenarioName.trim(),
                                    color_token: CATEGORY_COLOR_OPTIONS[(gradebook.scenarios.length + 1) % CATEGORY_COLOR_OPTIONS.length].value,
                                }));
                                setNewScenarioName('');
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add
                        </Button>
                    </div>
                </div>
            </SettingsSection>

            {/* ── Categories ─────────────────────────────────────────────── */}
            <SettingsSection title="Categories" description="Organize groupings for the assessments.">
                <CrudPanel
                    title="Categories"
                    description="All assessment categories for this course."
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
                                                            api.deleteCourseGradebookCategory(courseId, category.id, { revision: gradebook.revision })
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
            id: 'gradebook-scenarios-categories',
            component: GradebookSettings,
            allowedContexts: ['course'],
        },
    ],
});
