import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/services/api';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import scheduleService, { type WeekPattern, type CourseEventType, type CourseEvent } from '@/services/schedule';

// --- Types & Constants ---

export const WEEK_PATTERNS: WeekPattern[] = ['EVERY', 'ODD', 'EVEN'];
export const DAY_OF_WEEK_OPTIONS = [
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
    { value: 7, label: 'Sun' },
];

const SLOT_PLANNER_STEP_MINUTES = 30;
export const SLOT_LOCATION_NOTE_PREFIX = '[loc] ';
const SEMESTER_SETTINGS_REQUIRED_MESSAGE = 'Semester dates are missing. Please complete them in Semester Settings first.';

export type SectionSlotDraft = {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    location: string;
};

// --- Helpers ---

export const slotId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const toMinutes = (value: string) => {
    const [hour, minute] = value.split(':').map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
    return (hour * 60) + minute;
};

export const formatHour = (minutes: number) => {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

export const toSafeTime = (value: string) => formatHour(Math.max(0, Math.min(23 * 60 + 59, toMinutes(value))));

export const timeRangeIsValid = (startTime: string, endTime: string) => toMinutes(endTime) > toMinutes(startTime);

export const clampMinute = (minute: number, min: number, max: number) => Math.min(max, Math.max(min, minute));

export const createSectionSlot = (
    dayOfWeek = 1,
    startTime = '09:00',
    endTime = '10:00',
    location = ''
): SectionSlotDraft => ({
    id: slotId(),
    dayOfWeek,
    startTime,
    endTime,
    location,
});

export const buildEventNoteWithLocation = (location: string, note?: string | null) => {
    const trimmedLocation = location.trim();
    const trimmedNote = note?.trim();
    return trimmedNote ? `${SLOT_LOCATION_NOTE_PREFIX}${trimmedLocation}\n${trimmedNote}` : `${SLOT_LOCATION_NOTE_PREFIX}${trimmedLocation}`;
};


// --- Components ---

const SectionSlotPlanner: React.FC<{
    slots: SectionSlotDraft[];
    onAddSlot: () => void;
    onUpdateSlot: (
        slotIdValue: string,
        patch: Partial<Pick<SectionSlotDraft, 'dayOfWeek' | 'startTime' | 'endTime' | 'location'>>
    ) => void;
    onRemoveSlot: (slotIdValue: string) => void;
}> = ({ slots, onAddSlot, onUpdateSlot, onRemoveSlot }) => {
    return (
        <div className="space-y-2">
            <div className="h-[240px] overflow-y-auto space-y-2 rounded-md border p-2 mb-2 scrollbar-thin scrollbar-thumb-muted">
                {slots.length === 0 && (
                    <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                        No slots yet. Use the button below to add one.
                    </div>
                )}

                {slots.map((slot, index) => (
                    <div key={slot.id} className="grid items-end gap-2 rounded-md border border-border/60 p-2 sm:grid-cols-[1fr_1fr_1fr_1.4fr_auto]">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Slot {index + 1}</Label>
                            <Select value={String(slot.dayOfWeek)}
                                onValueChange={(value) => onUpdateSlot(slot.id, { dayOfWeek: Number(value) })}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select day" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Days</SelectLabel>
                                        {DAY_OF_WEEK_OPTIONS.map((dayOption) => (
                                            <SelectItem key={`slot-day-option-${slot.id}-${dayOption.value}`} value={String(dayOption.value)}>
                                                {dayOption.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Start</Label>
                            <Input
                                type="time"
                                step={SLOT_PLANNER_STEP_MINUTES * 60}
                                value={slot.startTime}
                                onChange={(event) => onUpdateSlot(slot.id, { startTime: toSafeTime(event.target.value) })}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">End</Label>
                            <Input
                                type="time"
                                step={SLOT_PLANNER_STEP_MINUTES * 60}
                                value={slot.endTime}
                                onChange={(event) => onUpdateSlot(slot.id, { endTime: toSafeTime(event.target.value) })}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Location</Label>
                            <Input
                                autoComplete="off"
                                placeholder="e.g. BA1130"
                                value={slot.location}
                                onChange={(event) => onUpdateSlot(slot.id, { location: event.target.value })}
                            />
                        </div>
                        <Button type="button" variant="ghost" size="icon" aria-label="Remove slot" onClick={() => onRemoveSlot(slot.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={onAddSlot}>
                <Plus className="mr-2 h-4 w-4" />
                Add Slot Row
            </Button>
        </div>
    );
};

export interface SectionFormData {
    sectionId: string;
    eventTypeCode: string;
    instructor: string;
    weekPattern: WeekPattern;
}

interface SectionFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    courseId: string;
    editingSectionId: string | null;
    initialData: SectionFormData;
    initialSlots: SectionSlotDraft[];
    eventTypes: CourseEventType[];
    existingEvents: CourseEvent[]; // Needed for update logic
    onOpenQuickAddType: () => void;
    onSuccess: () => Promise<void>;
}

export const SectionFormDialog: React.FC<SectionFormDialogProps> = ({
    open,
    onOpenChange,
    courseId,
    editingSectionId,
    initialData,
    initialSlots,
    eventTypes,
    existingEvents,
    onOpenQuickAddType,
    onSuccess,
}) => {
    const [formSection, setFormSection] = React.useState<SectionFormData>(initialData);
    const [formSlots, setFormSlots] = React.useState<SectionSlotDraft[]>(initialSlots);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Sync with initialData when dialog opens or data changes
    React.useEffect(() => {
        if (open) {
            setFormSection(initialData);
            setFormSlots(initialSlots);
        }
    }, [open, initialData, initialSlots]);

    const resolveTermEndWeek = React.useCallback(async () => {
        const course = await api.getCourse(courseId);
        const semesterId = course.semester_id;
        if (!semesterId) {
            throw new Error('Course is not linked to a semester. Please link it and complete Semester Settings.');
        }

        const semester = await api.getSemester(semesterId);
        if (!semester.start_date || !semester.end_date) {
            throw new Error(SEMESTER_SETTINGS_REQUIRED_MESSAGE);
        }

        const scheduleSnapshot = await scheduleService.getCourseSchedule(courseId, {
            week: 1,
            withConflicts: false,
        });

        const resolvedMaxWeek = Math.floor(Number(scheduleSnapshot.maxWeek));
        if (!Number.isFinite(resolvedMaxWeek) || resolvedMaxWeek < 1) {
            throw new Error(SEMESTER_SETTINGS_REQUIRED_MESSAGE);
        }

        return resolvedMaxWeek;
    }, [courseId]);

    const currentNormalizedSlots = React.useMemo(() => {
        const normalized = formSlots.map((slot) => ({
            ...slot,
            startTime: toSafeTime(slot.startTime),
            endTime: toSafeTime(slot.endTime),
            dayOfWeek: clampMinute(Math.round(slot.dayOfWeek), 1, 7),
            location: slot.location.trim(),
        }));
        normalized.sort((a, b) => a.dayOfWeek - b.dayOfWeek || toMinutes(a.startTime) - toMinutes(b.startTime));
        return normalized;
    }, [formSlots]);

    const handleSaveSection = async () => {
        if (currentNormalizedSlots.length === 0) {
            toast.error('Add at least one slot.');
            return;
        }
        if (!formSection.sectionId) {
            toast.error('Section ID is required.');
            return;
        }
        const invalidSlot = currentNormalizedSlots.find((slot) => !timeRangeIsValid(slot.startTime, slot.endTime));
        if (invalidSlot) {
            toast.error(`Invalid time range.`);
            return;
        }

        const uniqueSlots = currentNormalizedSlots.filter((slot, index, array) =>
            array.findIndex(
                (c) =>
                    c.dayOfWeek === slot.dayOfWeek &&
                    c.startTime === slot.startTime &&
                    c.endTime === slot.endTime &&
                    c.location === slot.location
            ) === index
        );

        setIsSubmitting(true);
        try {
            const termEndWeek = await resolveTermEndWeek();
            const canonical = uniqueSlots[0];
            const commonData = {
                eventTypeCode: formSection.eventTypeCode,
                instructor: formSection.instructor || null,
                weekPattern: formSection.weekPattern,
                dayOfWeek: canonical.dayOfWeek,
                startTime: canonical.startTime,
                endTime: canonical.endTime,
                location: uniqueSlots.length === 1 ? canonical.location : 'Multiple locations',
                startWeek: 1,
                endWeek: termEndWeek,
            };

            const createEventsOps = uniqueSlots.map((slot) => ({
                op: 'create' as const,
                data: {
                    eventTypeCode: formSection.eventTypeCode,
                    sectionId: formSection.sectionId, // Use the new section ID
                    title: null,
                    dayOfWeek: slot.dayOfWeek,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    weekPattern: formSection.weekPattern,
                    startWeek: 1,
                    endWeek: termEndWeek,
                    enable: true,
                    skip: false,
                    note: buildEventNoteWithLocation(slot.location),
                },
            }));

            if (editingSectionId) {
                if (editingSectionId !== formSection.sectionId) {
                    // RENAME SCENARIO: Delete old section -> Create new section -> Create new events
                    await scheduleService.deleteCourseSection(courseId, editingSectionId);

                    await scheduleService.createCourseSection(courseId, {
                        sectionId: formSection.sectionId,
                        ...commonData,
                    });

                    await scheduleService.batchCourseEvents(courseId, {
                        atomic: true,
                        items: createEventsOps,
                    });
                } else {
                    // UPDATE SCENARIO: Update metadata -> Replace events
                    await scheduleService.updateCourseSection(courseId, editingSectionId, commonData);

                    // existingEvents needs to be filtered for this section if passed as full list, 
                    // but let's assume parent passes relevant ones or let's double check.
                    // Parent passes `existingEvents` which might be ALL events or just section events.
                    // PROPOSAL: The parent should pass ONLY events for this section or we filter here.
                    // Let's filter just in case, but `editingSectionId` matches.
                    const sectionEvents = existingEvents.filter(e => e.sectionId === editingSectionId);

                    const deleteOps = sectionEvents.map(e => ({ op: 'delete' as const, eventId: e.id }));

                    await scheduleService.batchCourseEvents(courseId, {
                        atomic: true,
                        items: [...deleteOps, ...createEventsOps],
                    });
                }
            } else {
                // CREATE SCENARIO
                await scheduleService.createCourseSection(courseId, {
                    sectionId: formSection.sectionId,
                    ...commonData,
                });

                await scheduleService.batchCourseEvents(courseId, {
                    atomic: true,
                    items: createEventsOps,
                });
            }

            onOpenChange(false);
            await onSuccess();
            // No success toast per user preference
        } catch (err: any) {
            toast.error(err?.response?.data?.detail?.message ?? err?.message ?? 'Failed to save section.');
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[840px]">
                <DialogHeader>
                    <DialogTitle>{editingSectionId ? 'Edit Section' : 'Create Section'}</DialogTitle>
                    <DialogDescription>
                        {editingSectionId ? 'Update section details and slots. This will regenerate all events for this section.' : 'Configure a new section and its weekly slots.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Event Type</Label>
                                <button
                                    type="button"
                                    onClick={onOpenQuickAddType}
                                    className="text-xs text-primary hover:underline hover:text-primary/80"
                                >
                                    + Add Type
                                </button>
                            </div>
                            <Select value={formSection.eventTypeCode}
                                onValueChange={(value) => setFormSection((prev) => ({ ...prev, eventTypeCode: value }))}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select event type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Event Types</SelectLabel>
                                        {eventTypes.map((item) => (
                                            <SelectItem key={item.code} value={item.code}>
                                                {item.code}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-section-id">Section Number</Label>
                            <Input
                                id="new-section-id"
                                autoComplete="off"
                                placeholder="101"
                                inputMode="numeric"
                                value={formSection.sectionId}
                                onChange={(event) => setFormSection((prev) => ({ ...prev, sectionId: event.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="new-section-instructor">Instructor</Label>
                            <Input
                                id="new-section-instructor"
                                autoComplete="off"
                                placeholder="Optional"
                                value={formSection.instructor}
                                onChange={(event) => setFormSection((prev) => ({ ...prev, instructor: event.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Pattern</Label>
                            <Select value={formSection.weekPattern}
                                onValueChange={(value) => setFormSection((prev) => ({ ...prev, weekPattern: value as WeekPattern }))}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select pattern" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Patterns</SelectLabel>
                                        {WEEK_PATTERNS.map((item) => (
                                            <SelectItem key={item} value={item}>
                                                {item}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Section Slots</Label>
                        <SectionSlotPlanner
                            slots={currentNormalizedSlots}
                            onAddSlot={() => setFormSlots((prev) => {
                                const last = prev[prev.length - 1];
                                let nextStart = '09:00';
                                let nextDay = 1;
                                const nextLoc = '';

                                if (last) {
                                    nextDay = last.dayOfWeek;
                                    // nextLoc = last.location; // Do not copy location
                                    // Try to be smart about next slot start
                                    const lastEndMin = toMinutes(last.endTime);
                                    nextStart = toSafeTime(formatHour(lastEndMin));
                                }

                                // Default duration 1 hour
                                const startMin = toMinutes(nextStart);
                                const endMin = startMin + 60;
                                const nextEnd = toSafeTime(formatHour(endMin));

                                return [...prev, createSectionSlot(nextDay, nextStart, nextEnd, nextLoc)];
                            })}
                            onUpdateSlot={(id, patch) => setFormSlots((prev) => prev.map(s => {
                                if (s.id !== id) return s;
                                const updated = { ...s, ...patch };
                                // Auto-update end time if start time changed
                                if (patch.startTime && !patch.endTime) {
                                    const startMin = toMinutes(patch.startTime);
                                    const endMin = startMin + 60;
                                    updated.endTime = toSafeTime(formatHour(endMin));
                                }
                                return updated;
                            }))}
                            onRemoveSlot={(id) => setFormSlots((prev) => prev.filter(s => s.id !== id))}
                        />
                    </div>

                    <div className="flex justify-end">
                        <Button type="button" onClick={handleSaveSection} disabled={!formSection.sectionId || isSubmitting}>
                            {editingSectionId ? 'Save Changes' : 'Create Section'}
                        </Button>
                    </div>



                </div>
            </DialogContent>
        </Dialog>
    );
};
