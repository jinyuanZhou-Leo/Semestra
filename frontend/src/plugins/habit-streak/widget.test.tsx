// input:  [HabitStreak widget/helper exports and testing-library render/event utilities]
// output: [vitest coverage for habit check-in windows, widget UI behavior, and header reset actions]
// pos:    [plugin-level regression tests for habit-streak helper logic and runtime contract expectations]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    HabitStreakWidget,
    HabitStreakWidgetDefinition,
    computeNextStreakCount,
    getCheckInWindowState,
} from './widget';

describe('HabitStreak helpers', () => {
    it('returns locked state when interval has not elapsed', () => {
        const now = Date.parse('2026-02-19T10:00:00.000Z');
        const lastCheckInAt = '2026-02-19T09:30:00.000Z';

        const state = getCheckInWindowState(lastCheckInAt, 1, now);

        expect(state.canCheckIn).toBe(false);
        expect(state.windowsSinceLast).toBe(0);
        expect(state.remainingMs).toBe(30 * 60 * 1000);
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
                checkInIntervalHours: 1,
                streakCount: 1,
                bestStreak: 1,
                totalCheckIns: 1,
                lastCheckInAt: expect.any(String),
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

    it('shows goal streak label and keeps legacy capsule text removed', () => {
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
                }}
                updateSettings={updateSettings}
            />
        );

        expect(screen.getByText('Goal: 30 streaks')).toBeInTheDocument();
        expect(screen.queryByText('5/30 streak')).not.toBeInTheDocument();
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
            showMotivationalMessage: true,
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
            showMotivationalMessage: false,
        });
    });
});
