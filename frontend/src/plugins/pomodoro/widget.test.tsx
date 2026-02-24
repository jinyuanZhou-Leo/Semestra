// input:  [Vitest + Testing Library, pomodoro widget runtime exports and helper functions]
// output: [unit tests validating pomodoro timer state transitions and header actions]
// pos:    [Plugin-level test suite covering timer behavior and widget definition contracts]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    DEFAULT_POMODORO_SETTINGS,
    PomodoroWidget,
    PomodoroWidgetDefinition,
    getCompletionTransition,
    normalizePomodoroSettings,
    type PomodoroSettings,
} from './widget';

describe('Pomodoro helpers', () => {
    it('normalizes invalid settings to safe defaults', () => {
        const normalized = normalizePomodoroSettings({
            mode: 'invalid',
            status: 'invalid',
            focusMinutes: -10,
            remainingSeconds: -4,
            sessionEndAt: 'oops',
            volume: 3,
        });

        expect(normalized.mode).toBe('focus');
        expect(normalized.status).toBe('idle');
        expect(normalized.focusMinutes).toBe(1);
        expect(normalized.remainingSeconds).toBe(60);
        expect(normalized.sessionEndAt).toBeNull();
        expect(normalized.volume).toBe(1);
    });

    it('moves from focus to long break on configured interval completion', () => {
        const nowMs = Date.parse('2026-02-24T00:00:00.000Z');
        const next = getCompletionTransition(
            {
                ...DEFAULT_POMODORO_SETTINGS,
                mode: 'focus',
                status: 'running',
                completedFocusCount: 3,
                longBreakInterval: 4,
                autoStartBreak: false,
            },
            nowMs
        );

        expect(next.mode).toBe('longBreak');
        expect(next.status).toBe('idle');
        expect(next.completedFocusCount).toBe(4);
        expect(next.remainingSeconds).toBe(15 * 60);
    });
});

describe('PomodoroWidget', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('starts timer and writes running state through updateSettings', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-24T00:00:00.000Z'));

        const updateSettings = vi.fn();

        render(
            <PomodoroWidget
                widgetId="pomodoro-1"
                settings={{ ...DEFAULT_POMODORO_SETTINGS }}
                updateSettings={updateSettings}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Start timer' }));

        expect(updateSettings).toHaveBeenCalledTimes(1);
        expect(updateSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'running',
                remainingSeconds: 1500,
                sessionEndAt: Date.parse('2026-02-24T00:25:00.000Z'),
            })
        );
    });

    it('pauses timer with updated remaining seconds', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-24T00:00:00.000Z'));

        const updateSettings = vi.fn();
        const runningSettings: PomodoroSettings = {
            ...DEFAULT_POMODORO_SETTINGS,
            status: 'running',
            remainingSeconds: 120,
            sessionEndAt: Date.parse('2026-02-24T00:02:00.000Z'),
        };

        render(
            <PomodoroWidget
                widgetId="pomodoro-2"
                settings={runningSettings}
                updateSettings={updateSettings}
            />
        );

        act(() => {
            vi.advanceTimersByTime(30_000);
        });

        fireEvent.click(screen.getByRole('button', { name: 'Pause timer' }));

        const lastPayload = updateSettings.mock.calls.at(-1)?.[0] as PomodoroSettings;
        expect(lastPayload.status).toBe('paused');
        expect(lastPayload.sessionEndAt).toBeNull();
        expect(lastPayload.remainingSeconds).toBeLessThanOrEqual(90);
        expect(lastPayload.remainingSeconds).toBeGreaterThanOrEqual(89);
    });

    it('transitions to long break when focus timer reaches zero', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-24T00:00:00.000Z'));

        const updateSettings = vi.fn();

        render(
            <PomodoroWidget
                widgetId="pomodoro-3"
                settings={{
                    ...DEFAULT_POMODORO_SETTINGS,
                    status: 'running',
                    mode: 'focus',
                    longBreakInterval: 4,
                    completedFocusCount: 3,
                    remainingSeconds: 1,
                    sessionEndAt: Date.parse('2026-02-24T00:00:01.000Z'),
                    autoStartBreak: false,
                }}
                updateSettings={updateSettings}
            />
        );

        act(() => {
            vi.advanceTimersByTime(1_250);
        });

        const completionPayload = updateSettings.mock.calls
            .map((entry) => entry[0] as PomodoroSettings)
            .find((payload) => payload.mode === 'longBreak');

        expect(completionPayload).toBeDefined();
        expect(completionPayload).toMatchObject({
            mode: 'longBreak',
            status: 'idle',
            completedFocusCount: 4,
            remainingSeconds: 15 * 60,
        });
    });

    it('auto-starts break when autoStartBreak is enabled', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-24T00:00:00.000Z'));

        const updateSettings = vi.fn();

        render(
            <PomodoroWidget
                widgetId="pomodoro-4"
                settings={{
                    ...DEFAULT_POMODORO_SETTINGS,
                    status: 'running',
                    mode: 'focus',
                    remainingSeconds: 1,
                    sessionEndAt: Date.parse('2026-02-24T00:00:01.000Z'),
                    autoStartBreak: true,
                    completedFocusCount: 0,
                }}
                updateSettings={updateSettings}
            />
        );

        act(() => {
            vi.advanceTimersByTime(1_250);
        });

        const payload = updateSettings.mock.calls
            .map((entry) => entry[0] as PomodoroSettings)
            .find((entry) => entry.mode === 'shortBreak');

        expect(payload).toBeDefined();
        expect(payload?.status).toBe('running');
        expect(payload?.sessionEndAt).not.toBeNull();
    });

    it('resets timer from header action button', () => {
        const resetAction = PomodoroWidgetDefinition.headerButtons?.find((button) => button.id === 'reset-session');
        const updateSettings = vi.fn();
        let actionHandler: (() => void | Promise<void>) | null = null;

        if (!resetAction) {
            throw new Error('Missing pomodoro reset-session action');
        }

        const node = resetAction.render(
            {
                widgetId: 'pomodoro-5',
                settings: {
                    ...DEFAULT_POMODORO_SETTINGS,
                    mode: 'shortBreak',
                    status: 'running',
                    remainingSeconds: 77,
                    sessionEndAt: Date.now() + 77_000,
                },
                updateSettings,
            },
            {
                ActionButton: (props) => {
                    actionHandler = props.onClick;
                    return null;
                },
                ConfirmActionButton: () => null,
            }
        );

        render(<>{node}</>);

        if (!actionHandler) {
            throw new Error('Missing reset-session callback');
        }

        const runAction = actionHandler as () => void | Promise<void>;
        void runAction();

        expect(updateSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'shortBreak',
                status: 'idle',
                remainingSeconds: DEFAULT_POMODORO_SETTINGS.shortBreakMinutes * 60,
                sessionEndAt: null,
            })
        );
    });

    it('cleans up timer interval on unmount', () => {
        vi.useFakeTimers();
        const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

        const { unmount } = render(
            <PomodoroWidget
                widgetId="pomodoro-6"
                settings={{
                    ...DEFAULT_POMODORO_SETTINGS,
                    status: 'running',
                    sessionEndAt: Date.now() + 60_000,
                    remainingSeconds: 60,
                }}
                updateSettings={vi.fn()}
            />
        );

        unmount();

        expect(clearIntervalSpy).toHaveBeenCalled();
    });
});
