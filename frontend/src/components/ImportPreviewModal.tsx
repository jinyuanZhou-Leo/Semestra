import React, { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Check, FileDown, ArrowRight, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProgramExport {
    name: string;
    cgpa_scaled: number;
    cgpa_percentage: number;
    gpa_scaling_table?: string;
    grad_requirement_credits: number;
    hide_gpa: boolean;
    semesters: SemesterExport[];
}

export interface SemesterExport {
    name: string;
    average_percentage: number;
    average_scaled: number;
    courses: CourseExport[];
    widgets: any[];
    tabs: any[];
}

export interface CourseExport {
    name: string;
    alias?: string;
    credits: number;
    grade_percentage: number;
    grade_scaled: number;
    include_in_gpa: boolean;
    hide_gpa: boolean;
    widgets: any[];
    tabs: any[];
}

export interface ImportData {
    version?: string;
    exported_at?: string;
    settings?: {
        nickname?: string;
        gpa_scaling_table?: string;
        default_course_credit?: number;
    };
    programs: ProgramExport[];
}

export type ConflictMode = 'skip' | 'overwrite' | 'rename';

interface ImportPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    importData: ImportData | null;
    existingProgramNames: string[];
    onConfirm: (mode: ConflictMode, includeSettings: boolean) => Promise<void>;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
    isOpen,
    onClose,
    importData,
    existingProgramNames,
    onConfirm
}) => {
    const [conflictMode, setConflictMode] = useState<ConflictMode>('skip');
    const [includeSettings, setIncludeSettings] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const radioBaseId = useId();
    const includeSettingsId = useId();

    const analysis = useMemo(() => {
        if (!importData) return { newPrograms: [], conflictPrograms: [], totalSemesters: 0, totalCourses: 0 };

        const existingNamesLower = new Set(existingProgramNames.map(n => n.toLowerCase()));
        const newPrograms: string[] = [];
        const conflictPrograms: string[] = [];
        let totalSemesters = 0;
        let totalCourses = 0;

        for (const program of importData.programs) {
            if (existingNamesLower.has(program.name.toLowerCase())) {
                conflictPrograms.push(program.name);
            } else {
                newPrograms.push(program.name);
            }
            totalSemesters += program.semesters.length;
            for (const semester of program.semesters) {
                totalCourses += semester.courses.length;
            }
        }

        return { newPrograms, conflictPrograms, totalSemesters, totalCourses };
    }, [importData, existingProgramNames]);

    const handleConfirm = async () => {
        setIsImporting(true);
        try {
            await onConfirm(conflictMode, includeSettings);
            toast.success('Import successful');
            onClose();
        } catch (error: any) {
            console.error('Import failed:', error);
            toast.error('Import failed', {
                description: error.message || 'An unexpected error occurred during import.',
                action: {
                    label: 'Retry',
                    onClick: handleConfirm,
                },
            });
        } finally {
            setIsImporting(false);
        }
    };

    if (!importData) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[550px] p-0 flex flex-col gap-0 overflow-hidden">
                <DialogHeader className="px-4 py-3 border-b bg-muted/20">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                        <FileDown className="h-4 w-4 text-primary" />
                        Import Preview
                    </DialogTitle>
                    <DialogDescription className="hidden">
                        Preview data to be imported
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 space-y-4">
                        {/* Compact Summary */}
                        <div className="bg-muted/40 rounded-md p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-y-2 text-xs border border-muted">
                            <div className="flex items-center gap-3">
                                <span className="font-semibold text-foreground">Summary</span>
                                <div className="h-3 w-px bg-border" />
                                <div className="flex gap-3 text-muted-foreground">
                                    <span><span className="font-medium text-foreground">{importData.programs.length}</span> Programs</span>
                                    <span><span className="font-medium text-foreground">{analysis.totalSemesters}</span> Semesters</span>
                                    <span><span className="font-medium text-foreground">{analysis.totalCourses}</span> Courses</span>
                                </div>
                            </div>
                            {importData.exported_at && (
                                <div className="text-muted-foreground text-[10px]">
                                    {new Date(importData.exported_at).toLocaleDateString()}
                                </div>
                            )}
                        </div>

                        {/* Programs List */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Programs</h3>
                                {analysis.conflictPrograms.length > 0 && (
                                    <Badge variant="outline" className="text-[10px] h-5 gap-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                                        <AlertTriangle className="h-3 w-3" />
                                        {analysis.conflictPrograms.length} conflicts
                                    </Badge>
                                )}
                            </div>
                            <Card className="overflow-hidden border-muted shadow-sm">
                                <ScrollArea className="h-[160px]">
                                    <div className="divide-y divide-muted/50">
                                        {analysis.newPrograms.map((name, i) => (
                                            <div key={`new-${i}`} className="flex items-center justify-between py-2 px-3 hover:bg-muted/30 transition-colors text-sm group">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                                                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                                                    </div>
                                                    <span className="font-medium text-foreground/90 group-hover:text-foreground transition-colors truncate max-w-[280px]">{name}</span>
                                                </div>
                                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400">
                                                    New
                                                </Badge>
                                            </div>
                                        ))}
                                        {analysis.conflictPrograms.map((name, i) => (
                                            <div key={`conflict-${i}`} className="flex items-center justify-between py-2 px-3 bg-amber-50/40 dark:bg-amber-900/10 hover:bg-amber-100/40 dark:hover:bg-amber-900/20 transition-colors text-sm group">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                                                        <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                                    </div>
                                                    <span className="font-medium text-foreground/90 group-hover:text-foreground transition-colors truncate max-w-[280px]">{name}</span>
                                                </div>
                                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400">
                                                    Conflict
                                                </Badge>
                                            </div>
                                        ))}
                                        {analysis.newPrograms.length === 0 && analysis.conflictPrograms.length === 0 && (
                                            <div className="p-6 text-center text-muted-foreground text-xs">
                                                No programs of interest found in import data
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </Card>
                        </div>

                        {/* Conflict Handling & Settings */}
                        {(analysis.conflictPrograms.length > 0 || importData.settings) && (
                            <div className="space-y-3 pt-1">
                                {/* Conflict Handling */}
                                {analysis.conflictPrograms.length > 0 && (
                                    <div className="space-y-2">
                                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Resolve Conflicts
                                        </h3>

                                        <RadioGroup
                                            value={conflictMode}
                                            onValueChange={(value) => setConflictMode(value as ConflictMode)}
                                            className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                                        >
                                            {([
                                                { value: 'skip', label: 'Skip', description: 'Ignore incoming' },
                                                { value: 'overwrite', label: 'Overwrite', description: 'Replace existing' },
                                                { value: 'rename', label: 'Rename', description: 'Keep both (Copy)' }
                                            ] as const).map((option, index) => {
                                                const id = `${radioBaseId}-${index}`;
                                                const isChecked = conflictMode === option.value;
                                                return (
                                                    <label
                                                        key={option.value}
                                                        htmlFor={id}
                                                        className={cn(
                                                            "relative flex flex-col items-start justify-center rounded-lg border p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all",
                                                            isChecked ? "border-primary bg-primary/5 shadow-sm" : "border-muted bg-transparent",
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2 w-full mb-1">
                                                            <RadioGroupItem value={option.value} id={id} className="h-3.5 w-3.5" />
                                                            <span className={cn("text-xs font-semibold leading-none", isChecked ? "text-primary" : "text-foreground")}>
                                                                {option.label}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground pl-[22px] leading-tight block">
                                                            {option.description}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </RadioGroup>
                                    </div>
                                )}

                                {analysis.conflictPrograms.length > 0 && importData.settings && <Separator className="my-2" />}

                                {/* Settings Toggle */}
                                {importData.settings && (
                                    <div className="flex items-center space-x-2.5 p-2.5 rounded-lg border border-dashed bg-muted/20">
                                        <Checkbox
                                            id={includeSettingsId}
                                            checked={includeSettings}
                                            onCheckedChange={(checked) => {
                                                if (checked === "indeterminate") return;
                                                setIncludeSettings(checked);
                                            }}
                                        />
                                        <div className="grid gap-0.5 leading-none">
                                            <Label htmlFor={includeSettingsId} className="text-xs font-medium cursor-pointer flex items-center gap-1.5 hover:text-primary transition-colors">
                                                <Settings2 className="h-3 w-3" />
                                                Import User Settings (Nickname, Defaults)
                                            </Label>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="px-4 py-3 border-t bg-muted/20 gap-2 sm:gap-0">
                    <Button variant="ghost" size="sm" onClick={onClose} disabled={isImporting} className="hidden sm:flex h-8 text-xs hover:bg-transparent text-muted-foreground hover:text-foreground">
                        Dismiss
                    </Button>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" size="sm" onClick={onClose} disabled={isImporting} className="sm:hidden flex-1 h-8 text-xs">
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleConfirm} disabled={isImporting} className="flex-1 sm:flex-none h-8 text-xs px-4">
                            {isImporting ? 'Importing...' : 'Confirm Import'}
                            {!isImporting && <ArrowRight className="ml-2 h-3.5 w-3.5" />}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
