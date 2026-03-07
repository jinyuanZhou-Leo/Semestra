// input:  [HabitStreak widget/helper exports and testing-library render/event utilities]
// output: [vitest coverage for habit check-in windows, real check-in history normalization, dual display-style widget UI behavior, ring-only encouragement toast behavior, and header reset actions]
// pos:    [plugin-level regression tests for habit-streak helper logic, minimal calendar-first 7-day board rendering, classic ring fallback, toast gating, and runtime contract expectations]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    HabitStreakWidget,
    HabitStreakWidgetDefinition,
    computeNextStreakCount,
    getCheckInWindowState,
    normalizeHabitStreakSettings,
} from './widget';

afterEach(() => {
    vi.useRealTimers();
});

describe('HabitStreak helpers', () => {
    it('falls back to the daily cadence when an unsupported interval is provided', () => {
        const now = Date.parse('2026-02-19T10:00:00.000Z');
        const lastCheckInAt = '2026-02-19T09:30:00.000Z';
        const startOfCurrentDay = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime();

        const state = getCheckInWindowState(lastCheckInAt, 1, now);

        expect(state.canCheckIn).toBe(false);
        expect(state.windowsSinceLast).toBe(0);
        expect(state.remainingMs).toBe(Math.max(0, startOfCurrentDay + 24 * 60 * 60 * 1000 - now));
    });

    it('resets streak when multiple windows are missed', () => {
        const nextStreak = computeNextStreakCount(8, 3, true);
        expect(nextStreak).toBe(1);
    });

    it('allows daily check-in on next calendar day even if less than 24 hours passed', () => {
        const now = new Date(2026, 1, 20, 0, 10, 0, 0).getTime();
        const lastCheckInAt = new Date(2026, 1, 19, 23, 50, 0, 0).toISOString();

        const state = getCheckInWindowState(lastCheckInAt, 24, now);

        expect(state.canCheckIn).toBe(true);
        expect(state.windowsSinceLast).toBe(1);
    });

    it('allows immediate repeated check-ins when interval is zero', () => {
        const now = Date.parse('2026-02-20T00:10:00.000Z');
        const lastCheckInAt = '2026-02-20T00:09:00.000Z';

        const state = getCheckInWindowState(lastCheckInAt, 0, now);

        expect(state.canCheckIn).toBe(true);
        expect(state.remainingMs).toBe(0);
    });

    it('supports weekly interval lock', () => {
        const now = Date.parse('2026-02-20T00:10:00.000Z');
        const lastCheckInAt = '2026-02-16T00:10:00.000Z';

        const state = getCheckInWindowState(lastCheckInAt, 168, now);

        expect(state.canCheckIn).toBe(false);
        expect(state.windowsSinceLast).toBe(0);
        expect(state.remainingMs).toBe(3 * 24 * 60 * 60 * 1000);
    });

    it('normalizes check-in history to recent unique local date keys', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-06T12:00:00.000Z'));

        const settings = normalizeHabitStreakSettings({
            checkInHistory: ['2026-03-06', '2026-02-30', '2025-11-10', '2026-03-05', '2026-03-06', 'bad-key'],
        });

        expect(settings.checkInHistory).toEqual(['2026-03-05', '2026-03-06']);
    });

    it('falls back to calendar display style when an invalid style is provided', () => {
        const settings = normalizeHabitStreakSettings({
            displayStyle: 'sparkle-orbit',
        });

        expect(settings.displayStyle).toBe('calendar');
    });

    it('locks calendar display style to daily cadence and disabled encouragement', () => {
        const settings = normalizeHabitStreakSettings({
            displayStyle: 'calendar',
            checkInIntervalHours: 168,
            showMotivationalMessage: true,
        });

        expect(settings.checkInIntervalHours).toBe(24);
        expect(settings.showMotivationalMessage).toBe(false);
    });
});

describe('HabitStreakWidget', () => {
    it('renders habit task as read-only title', () => {
        const updateSettings = vi.fn();

        render(
            <HabitStreakWidget
                widgetId="habit-1"
                settings={{
                    habitName: 'Read chapter',
                    checkInIntervalHours: 24,
                    streakCount: 0,
                    bestStreak: 0,
                    totalCheckIns: 0,
                    lastCheckInAt: null,
                }}
                updateSettings={updateSettings}
            />
        );

        expect(screen.getByText('Read chapter')).toBeInTheDocument();
        expect(updateSettings).not.toHaveBeenCalled();
    });

    it('increments streak when check-in is available', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-06T14:30:00.000Z'));
        const updateSettings = vi.fn();

        render(
            <HabitStreakWidget
                widgetId="habit-2"
                settings={{
                    habitName: 'Workout',
                    checkInIntervalHours: 1,
                    streakCount: 0,
                    bestStreak: 0,
                    totalCheckIns: 0,
                    lastCheckInAt: null,
                }}
                updateSettings={updateSettings}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Check In' }));

        expect(updateSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                habitName: 'Workout',
                checkInIntervalHours: 24,
                streakCount: 1,
                bestStreak: 1,
                totalCheckIns: 1,
                lastCheckInAt: '2026-03-06T14:30:00.000Z',
                checkInHistory: ['2026-03-06'],
                displayStyle: 'calendar',
                targetStreak: 21,
                showMotivationalMessage: false,
            })
        );
    });

    it('keeps same-day repeat check-ins from duplicating the calendar history', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-06T18:20:00.000Z'));
        const updateSettings = vi.fn();

        render(
            <HabitStreakWidget
                widgetId="habit-repeat"
                settings={{
                    habitName: 'Spanish',
                    checkInIntervalHours: 0,
                    targetStreak: 21,
                    streakCount: 4,
                    bestStreak: 8,
                    totalCheckIns: 11,
                    lastCheckInAt: '2026-03-06T08:00:00.000Z',
                    checkInHistory: ['2026-03-06'],
                    displayStyle: 'ring',
                }}
                updateSettings={updateSettings}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Check In' }));

        expect(updateSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                totalCheckIns: 12,
                checkInHistory: ['2026-03-06'],
            })
        );
    });

    it('disables check-in before interval finishes', () => {
        const updateSettings = vi.fn();

        render(
            <HabitStreakWidget
                widgetId="habit-3"
                settings={{
                    habitName: 'Flash cards',
                    checkInIntervalHours: 24,
                    streakCount: 2,
                    bestStreak: 2,
                    totalCheckIns: 2,
                    lastCheckInAt: new Date().toISOString(),
                }}
                updateSettings={updateSettings}
            />
        );

        const button = screen.getByRole('button', { name: /Wait/ });
        expect(button).toBeDisabled();
    });

    it('keeps the legacy capsule text removed without rendering a goal label row', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-06T10:00:00.000Z'));
        const updateSettings = vi.fn();

        render(
            <HabitStreakWidget
                widgetId="habit-target"
                settings={{
                    habitName: 'Daily writing',
                    checkInIntervalHours: 24,
                    targetStreak: 30,
                    streakCount: 5,
                    bestStreak: 7,
                    totalCheckIns: 12,
                    lastCheckInAt: null,
                    checkInHistory: ['2026-03-02', '2026-03-05', '2026-03-06'],
                }}
                updateSettings={updateSettings}
            />
        );

        expect(screen.queryByText('Goal: 30 streaks')).not.toBeInTheDocument();
        expect(screen.queryByText('5/30 streak')).not.toBeInTheDocument();
        expect(screen.queryByText('Day Streak')).not.toBeInTheDocument();
        expect(screen.getByText('Week')).toBeInTheDocument();
        expect(screen.getByTestId('habit-calendar-board')).toBeInTheDocument();
        expect(screen.queryByTestId('habit-calendar-summary')).not.toBeInTheDocument();
        expect(screen.getByText('5d')).toBeInTheDocument();
        expect(screen.queryByText('Keep the row alive')).not.toBeInTheDocument();
        expect(screen.getAllByTestId(/habit-day-/)).toHaveLength(7);
        expect(screen.getByTestId('habit-day-2026-03-06')).toHaveAttribute('data-today', 'true');
        expect(screen.getByTestId('habit-day-2026-03-05')).toHaveAttribute('data-completed', 'true');
        expect(screen.getByTestId('habit-day-2026-03-04')).toHaveAttribute('data-completed', 'false');
    });

    it('renders the classic ring view when selected in settings', () => {
        const updateSettings = vi.fn();

        render(
            <HabitStreakWidget
                widgetId="habit-ring"
                settings={{
                    habitName: 'Stretch',
                    checkInIntervalHours: 24,
                    targetStreak: 12,
                    streakCount: 4,
                    bestStreak: 9,
                    totalCheckIns: 15,
                    lastCheckInAt: null,
                    displayStyle: 'ring',
                }}
                updateSettings={updateSettings}
            />
        );

        expect(screen.getByTestId('habit-display-ring')).toBeInTheDocument();
        expect(screen.getByText('Streak')).toBeInTheDocument();
        expect(screen.queryAllByTestId(/habit-day-/)).toHaveLength(0);
        expect(screen.queryByText('Day Streak')).not.toBeInTheDocument();
    });

    it('does not show encouragement text in Duolingo calendar view', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-06T10:00:00.000Z'));
        const updateSettings = vi.fn();

        render(
            <HabitStreakWidget
                widgetId="habit-calendar-toast"
                settings={{
                    habitName: 'Practice piano',
                    checkInIntervalHours: 0,
                    targetStreak: 21,
                    streakCount: 2,
                    bestStreak: 5,
                    totalCheckIns: 7,
                    lastCheckInAt: null,
                    displayStyle: 'calendar',
                    showMotivationalMessage: true,
                }}
                updateSettings={updateSettings}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Check In' }));

        expect(screen.queryByTestId('habit-motivational-toast')).not.toBeInTheDocument();
    });

    it('disables cadence and encouragement settings in Duolingo calendar view', () => {
        const SettingsComponent = HabitStreakWidgetDefinition.SettingsComponent;
        const onSettingsChange = vi.fn();

        if (!SettingsComponent) {
            throw new Error('Missing habit-streak settings component');
        }

        render(
            <SettingsComponent
                settings={{
                    displayStyle: 'calendar',
                    checkInIntervalHours: 168,
                    showMotivationalMessage: true,
                }}
                onSettingsChange={onSettingsChange}
            />
        );

        expect(screen.getByLabelText('Check-in cadence')).toBeDisabled();
        expect(screen.getByLabelText('Encouragement on check-in')).toBeDisabled();
        expect(screen.getByText('Hidden in Duolingo calendar view, preserved for classic ring.')).toBeInTheDocument();
        expect(onSettingsChange).not.toHaveBeenCalled();
    });

    it('resets streak through header confirm action', () => {
        const resetAction = HabitStreakWidgetDefinition.headerButtons?.find((button) => button.id === 'reset-streak');
        const updateSettings = vi.fn();
        let confirmAction: (() => void | Promise<void>) | null = null;

        if (!resetAction) {
            throw new Error('Missing habit-streak reset action');
        }

        const actionNode = resetAction.render(
            {
                widgetId: 'habit-4',
                settings: {
                    habitName: 'Meditate',
                    checkInIntervalHours: 24,
                    targetStreak: 14,
                    streakCount: 6,
                    bestStreak: 9,
                    totalCheckIns: 22,
                    lastCheckInAt: '2026-02-19T09:00:00.000Z',
                    checkInHistory: ['2026-02-17', '2026-02-18', '2026-02-19'],
                },
                updateSettings,
            },
            {
                ActionButton: () => null,
                ConfirmActionButton: (props) => {
                    confirmAction = props.onClick;
                    return null;
                },
            }
        );

        render(<>{actionNode}</>);

        if (!confirmAction) {
            throw new Error('Missing reset confirm callback');
        }
        const runConfirm = confirmAction as (() => void | Promise<void>);
        void runConfirm();

        expect(updateSettings).toHaveBeenCalledWith({
            habitName: 'Meditate',
            checkInIntervalHours: 24,
            targetStreak: 14,
            streakCount: 0,
            bestStreak: 0,
            totalCheckIns: 0,
            lastCheckInAt: null,
            checkInHistory: [],
            displayStyle: 'calendar',
            showMotivationalMessage: false,
        });
    });

    it('preserves motivational message preference when reset from header action', () => {
        const resetAction = HabitStreakWidgetDefinition.headerButtons?.find((button) => button.id === 'reset-streak');
        const updateSettings = vi.fn();
        let confirmAction: (() => void | Promise<void>) | null = null;

        if (!resetAction) {
            throw new Error('Missing habit-streak reset action');
        }

        const actionNode = resetAction.render(
            {
                widgetId: 'habit-5',
                settings: {
                    habitName: 'Read',
                    checkInIntervalHours: 24,
                    targetStreak: 21,
                    streakCount: 10,
                    bestStreak: 10,
                    totalCheckIns: 18,
                    lastCheckInAt: '2026-02-20T09:00:00.000Z',
                    checkInHistory: ['2026-02-20'],
                    showMotivationalMessage: false,
                },
                updateSettings,
            },
            {
                ActionButton: () => null,
                ConfirmActionButton: (props) => {
                    confirmAction = props.onClick;
                    return null;
                },
            }
        );

        render(<>{actionNode}</>);

        if (!confirmAction) {
            throw new Error('Missing reset confirm callback');
        }
        const runConfirm = confirmAction as (() => void | Promise<void>);
        void runConfirm();

        expect(updateSettings).toHaveBeenCalledWith({
            habitName: 'Read',
            checkInIntervalHours: 24,
            targetStreak: 21,
            streakCount: 0,
            bestStreak: 0,
            totalCheckIns: 0,
            lastCheckInAt: null,
            checkInHistory: [],
            displayStyle: 'calendar',
            showMotivationalMessage: false,
        });
    });
});
