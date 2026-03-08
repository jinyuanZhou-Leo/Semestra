// input:  [habit-streak widget/helper exports, mocked sibling-sync API calls, and testing-library render/event utilities]
// output: [vitest coverage for habit check-in windows, shared normalization, dual widget rendering, sibling data sync, mode-specific settings, single-shell chrome, and header reset actions]
// pos:    [plugin-level regression tests for the split Duolingo/Ring habit-streak widgets and their shared streak model]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../services/api';
import {
    HabitStreakDuolingoWidget,
    HabitStreakDuolingoWidgetDefinition,
    HabitStreakRingWidget,
    HabitStreakRingWidgetDefinition,
    computeNextStreakCount,
    getCheckInWindowState,
    normalizeHabitStreakDuolingoSettings,
    normalizeHabitStreakRingSettings,
    resetHabitStreakSharedStoreForTests,
} from './widget';

vi.mock('../../services/api', () => ({
    default: {
        updateWidget: vi.fn().mockResolvedValue({}),
    },
}));

const mockedApi = vi.mocked(api);

afterEach(() => {
    vi.useRealTimers();
});

beforeEach(() => {
    mockedApi.updateWidget.mockClear();
    resetHabitStreakSharedStoreForTests();
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

    it('normalizes Duolingo settings to recent unique local date keys', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-06T12:00:00.000Z'));

        const settings = normalizeHabitStreakDuolingoSettings({
            checkInHistory: ['2026-03-06', '2026-02-30', '2025-11-10', '2026-03-05', '2026-03-06', 'bad-key'],
        });

        expect(settings.checkInHistory).toEqual(['2026-03-05', '2026-03-06']);
    });

    it('defaults ring encouragement to enabled when missing', () => {
        const settings = normalizeHabitStreakRingSettings({});
        expect(settings.showMotivationalMessage).toBe(true);
    });
});

describe('HabitStreak widgets', () => {
    it('renders Duolingo widget title as read-only text', () => {
        const updateSettings = vi.fn();

        render(
            <HabitStreakDuolingoWidget
                widgetId="habit-duo-title"
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

    it('renders the ring widget when using the ring definition', () => {
        const updateSettings = vi.fn();

        render(
            <HabitStreakRingWidget
                widgetId="habit-ring"
                settings={{
                    habitName: 'Stretch',
                    checkInIntervalHours: 24,
                    targetStreak: 12,
                    streakCount: 4,
                    bestStreak: 9,
                    totalCheckIns: 15,
                    lastCheckInAt: null,
                }}
                updateSettings={updateSettings}
            />
        );

        expect(screen.getByTestId('habit-display-ring')).toBeInTheDocument();
        expect(screen.getByText('Streak')).toBeInTheDocument();
        expect(screen.queryAllByTestId(/habit-day-/)).toHaveLength(0);
    });

    it('increments streak in the Duolingo widget and syncs the sibling ring widget', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-06T14:30:00.000Z'));
        const updateDuolingoSettings = vi.fn();
        const updateRingSettings = vi.fn();

        render(
            <>
                <HabitStreakDuolingoWidget
                    widgetId="habit-duo"
                    semesterId="semester-1"
                    settings={{
                        habitName: 'Workout',
                        checkInIntervalHours: 24,
                        streakCount: 0,
                        bestStreak: 0,
                        totalCheckIns: 0,
                        lastCheckInAt: null,
                    }}
                    updateSettings={updateDuolingoSettings}
                />
                <HabitStreakRingWidget
                    widgetId="habit-ring"
                    semesterId="semester-1"
                    settings={{
                        habitName: 'Workout',
                        checkInIntervalHours: 24,
                        targetStreak: 21,
                        streakCount: 0,
                        bestStreak: 0,
                        totalCheckIns: 0,
                        lastCheckInAt: null,
                        showMotivationalMessage: false,
                    }}
                    updateSettings={updateRingSettings}
                />
            </>
        );

        fireEvent.click(screen.getAllByRole('button', { name: 'Check In' })[0]);

        expect(updateDuolingoSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                streakCount: 1,
                bestStreak: 1,
                totalCheckIns: 1,
                lastCheckInAt: '2026-03-06T14:30:00.000Z',
                checkInHistory: ['2026-03-06'],
            })
        );

        const ring = screen.getByTestId('habit-display-ring');
        expect(within(ring).getByText('1')).toBeInTheDocument();

        await Promise.resolve();

        expect(mockedApi.updateWidget).toHaveBeenCalledWith(
            'habit-ring',
            expect.objectContaining({
                settings: expect.any(String),
            })
        );
    });

    it('keeps same-day repeat check-ins from duplicating the shared history', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-06T18:20:00.000Z'));
        const updateSettings = vi.fn();

        render(
            <HabitStreakRingWidget
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
                    showMotivationalMessage: false,
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
            <HabitStreakRingWidget
                widgetId="habit-locked"
                settings={{
                    habitName: 'Flash cards',
                    checkInIntervalHours: 24,
                    targetStreak: 12,
                    streakCount: 2,
                    bestStreak: 2,
                    totalCheckIns: 2,
                    lastCheckInAt: new Date().toISOString(),
                    showMotivationalMessage: true,
                }}
                updateSettings={updateSettings}
            />
        );

        const button = screen.getByRole('button', { name: /Wait/ });
        expect(button).toBeDisabled();
    });

    it('renders the minimal Duolingo board without the removed goal label row', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-06T10:00:00.000Z'));
        const updateSettings = vi.fn();

        render(
            <HabitStreakDuolingoWidget
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
        expect(screen.getByText('Week')).toBeInTheDocument();
        expect(screen.getByTestId('habit-calendar-board')).toBeInTheDocument();
        expect(screen.getByText('5d')).toBeInTheDocument();
        expect(screen.getAllByTestId(/habit-day-/)).toHaveLength(7);
        expect(screen.getByTestId('habit-day-2026-03-06')).toHaveAttribute('data-today', 'true');
        expect(screen.getByTestId('habit-day-2026-03-05')).toHaveAttribute('data-completed', 'true');
        expect(screen.getByTestId('habit-day-2026-03-04')).toHaveAttribute('data-completed', 'false');
    });

    it('does not add an inner outline shell on top of the shared widget container', () => {
        const updateSettings = vi.fn();
        const { container } = render(
            <HabitStreakRingWidget
                widgetId="habit-shell"
                settings={{
                    habitName: 'Stretch',
                    checkInIntervalHours: 24,
                    targetStreak: 12,
                    streakCount: 4,
                    bestStreak: 9,
                    totalCheckIns: 15,
                    lastCheckInAt: null,
                    showMotivationalMessage: false,
                }}
                updateSettings={updateSettings}
            />
        );

        const root = container.querySelector('.habit-streak-widget');
        expect(root).toBeInTheDocument();
        expect(root).not.toHaveClass('outline');
        expect(root).not.toHaveClass('outline-1');
    });

    it('does not show encouragement text in the Duolingo widget', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-06T10:00:00.000Z'));
        const updateSettings = vi.fn();

        render(
            <HabitStreakDuolingoWidget
                widgetId="habit-calendar-toast"
                settings={{
                    habitName: 'Practice piano',
                    checkInIntervalHours: 0,
                    targetStreak: 21,
                    streakCount: 2,
                    bestStreak: 5,
                    totalCheckIns: 7,
                    lastCheckInAt: null,
                }}
                updateSettings={updateSettings}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Check In' }));

        expect(screen.queryByTestId('habit-motivational-toast')).not.toBeInTheDocument();
    });

    it('shows encouragement text in the ring widget when enabled', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-06T10:00:00.000Z'));
        const updateSettings = vi.fn();

        render(
            <HabitStreakRingWidget
                widgetId="habit-ring-toast"
                settings={{
                    habitName: 'Practice piano',
                    checkInIntervalHours: 0,
                    targetStreak: 21,
                    streakCount: 2,
                    bestStreak: 5,
                    totalCheckIns: 7,
                    lastCheckInAt: null,
                    showMotivationalMessage: true,
                }}
                updateSettings={updateSettings}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Check In' }));

        expect(screen.getByTestId('habit-motivational-toast')).toBeInTheDocument();
    });

    it('shows only Duolingo-appropriate settings in the Duolingo widget settings panel', () => {
        const SettingsComponent = HabitStreakDuolingoWidgetDefinition.SettingsComponent;
        const onSettingsChange = vi.fn();

        if (!SettingsComponent) {
            throw new Error('Missing Duolingo settings component');
        }

        render(
            <SettingsComponent
                settings={{
                    habitName: 'Read',
                    targetStreak: 14,
                }}
                onSettingsChange={onSettingsChange}
            />
        );

        expect(screen.getByLabelText('Habit')).toBeInTheDocument();
        expect(screen.getByLabelText('Target streak (count)')).toBeInTheDocument();
        expect(screen.queryByLabelText('Check-in cadence')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Encouragement on check-in')).not.toBeInTheDocument();
    });

    it('shows cadence and encouragement settings in the ring widget settings panel', () => {
        const SettingsComponent = HabitStreakRingWidgetDefinition.SettingsComponent;
        const onSettingsChange = vi.fn();

        if (!SettingsComponent) {
            throw new Error('Missing ring settings component');
        }

        render(
            <SettingsComponent
                settings={{
                    checkInIntervalHours: 168,
                    showMotivationalMessage: true,
                }}
                onSettingsChange={onSettingsChange}
            />
        );

        expect(screen.getByLabelText('Check-in cadence')).toBeInTheDocument();
        expect(screen.getByLabelText('Encouragement on check-in')).toBeInTheDocument();
    });

    it('resets the shared streak through the Duolingo header action and syncs the sibling widget', async () => {
        const resetAction = HabitStreakDuolingoWidgetDefinition.headerButtons?.find((button) => button.id === 'reset-streak');
        const updateSettings = vi.fn();
        let confirmAction: (() => void | Promise<void>) | null = null;

        if (!resetAction) {
            throw new Error('Missing Duolingo reset action');
        }

        render(
            <HabitStreakRingWidget
                widgetId="habit-ring"
                semesterId="semester-2"
                settings={{
                    habitName: 'Meditate',
                    checkInIntervalHours: 24,
                    targetStreak: 14,
                    streakCount: 6,
                    bestStreak: 9,
                    totalCheckIns: 22,
                    lastCheckInAt: '2026-02-19T09:00:00.000Z',
                    checkInHistory: ['2026-02-17', '2026-02-18', '2026-02-19'],
                    showMotivationalMessage: false,
                }}
                updateSettings={vi.fn()}
            />
        );

        const actionNode = resetAction.render(
            {
                widgetId: 'habit-duo',
                semesterId: 'semester-2',
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
        await act(async () => {
            await confirmAction();
        });

        expect(updateSettings).toHaveBeenCalledWith({
            habitName: 'Meditate',
            checkInIntervalHours: 24,
            targetStreak: 14,
            streakCount: 0,
            bestStreak: 0,
            totalCheckIns: 0,
            lastCheckInAt: null,
            checkInHistory: [],
        });

        await waitFor(() => {
            expect(mockedApi.updateWidget).toHaveBeenCalledWith(
                'habit-ring',
                expect.objectContaining({
                    settings: expect.any(String),
                })
            );
        });
    });
});
