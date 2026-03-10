import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Save, Star, Trash2, Layers3, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { definePluginSettings } from '@/plugin-system/contracts';
import type { PluginSettingsProps } from '@/services/pluginSettingsRegistry';
import api, { type CourseGradebook } from '@/services/api';

import { SettingsSection } from '@/components/SettingsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getCategoryBadgeClassName, getScenarioSwatchClassName, CATEGORY_COLOR_OPTIONS, getApiErrorMessage } from './shared';

const GradebookSettings: React.FC<PluginSettingsProps> = ({
    courseId,
    onRefresh,
}) => {
    const [gradebook, setGradebook] = useState<CourseGradebook | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);

    const [newScenarioName, setNewScenarioName] = useState('');
    const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
    const [editingScenarioName, setEditingScenarioName] = useState('');

    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState<string>(CATEGORY_COLOR_OPTIONS[0].value);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');

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

    const commitGradebook = useCallback(async (promise: Promise<CourseGradebook>, successMessage?: string) => {
        setIsMutating(true);
        try {
            const response = await promise;
            setGradebook(response);
            onRefresh();
            if (successMessage) {
                toast.success(successMessage);
            }
        } catch (error: unknown) {
            console.error('Failed to update gradebook', error);
            if (typeof error === 'object' && error !== null && 'response' in error && (error as { response?: { status?: number } }).response?.status === 409) {
                toast.error('Gradebook revision conflict. Reloading the latest data.');
                await loadGradebook();
                return;
            }
            toast.error(getApiErrorMessage(error));
        } finally {
            setIsMutating(false);
        }
    }, [loadGradebook, onRefresh]);

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
                                    />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className={cn('h-2.5 w-2.5 rounded-full', getScenarioSwatchClassName(scenario.color_token))} />
                                        <span className="text-sm font-medium text-foreground">{scenario.name}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    {scenario.is_baseline && <Badge variant="secondary" className="h-5 rounded-sm px-1.5 text-[10px] uppercase tracking-wider">Baseline</Badge>}
                                </div>
                            </div>

                            <div className="flex items-center gap-1 sm:justify-end">
                                {editingScenarioId === scenario.id ? (
                                    <Button
                                        type="button" size="icon-sm" variant="ghost" disabled={isMutating}
                                        onClick={() => {
                                            void commitGradebook(api.updateCourseGradebookScenario(courseId, scenario.id, {
                                                revision: gradebook.revision,
                                                name: editingScenarioName.trim()
                                            }), 'Scenario updated.');
                                            setEditingScenarioId(null);
                                            setEditingScenarioName('');
                                        }}
                                    ><Save className="h-4 w-4" /></Button>
                                ) : (
                                    <Button
                                        type="button" size="icon-sm" variant="ghost" disabled={isMutating}
                                        onClick={() => {
                                            setEditingScenarioId(scenario.id);
                                            setEditingScenarioName(scenario.name);
                                        }}
                                    ><Pencil className="h-4 w-4" /></Button>
                                )}

                                {!scenario.is_baseline ? (
                                    <Button
                                        type="button" size="icon-sm" variant="ghost" disabled={isMutating}
                                        onClick={() => void commitGradebook(api.updateCourseGradebookScenario(courseId, scenario.id, {
                                            revision: gradebook.revision,
                                            is_baseline: true,
                                        }), 'Baseline scenario updated.')}
                                    ><Star className="h-4 w-4 text-muted-foreground hover:text-foreground" /></Button>
                                ) : null}

                                {gradebook.scenarios.length > 1 ? (
                                    <Button
                                        type="button" size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={isMutating}
                                        onClick={() => void commitGradebook(api.deleteCourseGradebookScenario(courseId, scenario.id, { revision: gradebook.revision }), 'Scenario deleted.')}
                                    ><Trash2 className="h-4 w-4" /></Button>
                                ) : null}
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
                        />
                        <Button
                            type="button" size="sm" disabled={isMutating || !newScenarioName.trim()}
                            onClick={() => {
                                void commitGradebook(api.createCourseGradebookScenario(courseId, {
                                    revision: gradebook.revision,
                                    name: newScenarioName.trim(),
                                    color_token: CATEGORY_COLOR_OPTIONS[(gradebook.scenarios.length + 1) % CATEGORY_COLOR_OPTIONS.length].value,
                                }), 'Scenario created.');
                                setNewScenarioName('');
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add
                        </Button>
                    </div>
                </div>
            </SettingsSection>

            <SettingsSection title="Categories" description="Organize groupings for the assessments.">
                <div className="space-y-4">
                    {gradebook.categories.map(category => (
                        <div key={category.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                {editingCategoryId === category.id ? (
                                    <Input
                                        value={editingCategoryName}
                                        onChange={(e) => setEditingCategoryName(e.target.value)}
                                        className="h-8 max-w-[200px]"
                                    />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={cn('border px-2 py-0.5 text-[11px]', getCategoryBadgeClassName(category.color_token))}>
                                            {category.name}
                                        </Badge>
                                        {category.is_builtin && <Badge variant="secondary" className="h-5 rounded-sm px-1.5 text-[10px] uppercase tracking-wider">Builtin</Badge>}
                                        {category.is_archived && <Badge variant="outline" className="h-5 rounded-sm px-1.5 text-[10px] uppercase tracking-wider">Archived</Badge>}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1 sm:justify-end">
                                {!category.is_builtin && editingCategoryId === category.id ? (
                                    <Button
                                        type="button" size="icon-sm" variant="ghost" disabled={isMutating}
                                        onClick={() => {
                                            void commitGradebook(api.updateCourseGradebookCategory(courseId, category.id, {
                                                revision: gradebook.revision,
                                                name: editingCategoryName.trim(),
                                            }), 'Category updated.');
                                            setEditingCategoryId(null);
                                            setEditingCategoryName('');
                                        }}
                                    ><Save className="h-4 w-4" /></Button>
                                ) : !category.is_builtin ? (
                                    <Button
                                        type="button" size="icon-sm" variant="ghost" disabled={isMutating}
                                        onClick={() => {
                                            setEditingCategoryId(category.id);
                                            setEditingCategoryName(category.name);
                                        }}
                                    ><Pencil className="h-4 w-4" /></Button>
                                ) : null}

                                {!category.is_builtin ? (
                                    <>
                                        <Button
                                            type="button" size="icon-sm" variant="ghost" disabled={isMutating}
                                            onClick={() => void commitGradebook(api.updateCourseGradebookCategory(courseId, category.id, {
                                                revision: gradebook.revision,
                                                is_archived: !category.is_archived,
                                            }), category.is_archived ? 'Category restored.' : 'Category archived.')}
                                        ><Layers3 className="h-4 w-4" /></Button>

                                        <Button
                                            type="button" size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={isMutating}
                                            onClick={() => void commitGradebook(api.deleteCourseGradebookCategory(courseId, category.id, { revision: gradebook.revision }), 'Category deleted.')}
                                        ><Trash2 className="h-4 w-4" /></Button>
                                    </>
                                ) : (
                                    <span className="text-xs text-muted-foreground mr-2">System controlled</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <Separator className="my-4" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                        <span className="text-sm font-medium">Add Category</span>
                        <p className="text-sm text-muted-foreground">Create a fresh custom category.</p>
                    </div>
                    <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
                        <Input
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Homework"
                            className="h-9 w-full sm:w-[140px]"
                        />
                        <Select value={newCategoryColor} onValueChange={setNewCategoryColor}>
                            <SelectTrigger className="h-9 w-[110px]">
                                <SelectValue placeholder="Color" />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORY_COLOR_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            type="button" size="sm" disabled={isMutating || !newCategoryName.trim()}
                            onClick={() => {
                                void commitGradebook(api.createCourseGradebookCategory(courseId, {
                                    revision: gradebook.revision,
                                    name: newCategoryName.trim(),
                                    color_token: newCategoryColor,
                                }), 'Category created.');
                                setNewCategoryName('');
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add
                        </Button>
                    </div>
                </div>
            </SettingsSection>
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
