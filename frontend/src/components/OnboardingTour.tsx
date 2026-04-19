// input:  [auth context completeOnboarding, tour step prop, complete callback]
// output: [interactive guided tour: spotlights real UI elements then walks through key concepts]
// pos:    [Mounted by OnboardingController in App.tsx; step prop drives which driver.js phase to render]

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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

export type TourStep =
    | 'highlight-new-program'      // /programs  — spotlight "New Program" btn, wait for click
    | 'program-dashboard-tour';    // /programs/:id — 4-step info sequence

export const TOUR_STEP_KEY = 'semestra_onboarding_step';

const SKIP_EVENT = 'semestra:tour:skip-requested';

interface Props {
    step: TourStep;
    onComplete: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDriverFn = (...args: any[]) => any;

interface PopoverElements {
    wrapper: HTMLElement;
    footer: HTMLElement;
    progress: HTMLElement;
    nextButton: HTMLButtonElement;
    previousButton: HTMLButtonElement;
    closeButton: HTMLButtonElement;
}

async function loadDriver(): Promise<AnyDriverFn> {
    const [mod] = await Promise.all([
        import('driver.js'),
        import('driver.js/dist/driver.css'),
    ]);
    return mod.driver;
}

function getPopoverClass() {
    return window.innerWidth < 768
        ? 'semestra-onboarding semestra-onboarding-mobile'
        : 'semestra-onboarding';
}

// Injects a small "Skip" text link in the top-right corner of the popover.
// Skip is always the lowest-priority action so it lives far from the nav buttons.
function injectSkipCorner(wrapper: HTMLElement) {
    const btn = document.createElement('button');
    btn.textContent = 'Skip';
    btn.className = 'semestra-onboarding-skip-corner';
    btn.addEventListener('click', () =>
        document.dispatchEvent(new CustomEvent(SKIP_EVENT))
    );
    wrapper.appendChild(btn);
}

// For the highlight step: driver hides the footer (showButtons trick), so we
// manually re-show it with only the step counter — no nav buttons.
function showCountOnlyFooter(popover: PopoverElements, label: string) {
    popover.nextButton.style.display = 'none';
    popover.previousButton.style.display = 'none';
    popover.closeButton.style.display = 'none';
    popover.progress.textContent = label;
    popover.progress.style.display = 'block';
    popover.footer.style.display = 'flex';
}

// ─── Component ─────────────────────────────────────────────────────────────��──

export function OnboardingTour({ step, onComplete }: Props) {
    const { completeOnboarding } = useAuth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const driverRef = useRef<any>(null);
    const [showSkipConfirm, setShowSkipConfirm] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    // Incrementing this causes the current step's useEffect to re-run and
    // rebuild driver.js after the user cancels a skip confirmation.
    const [retryKey, setRetryKey] = useState(0);

    // Skip button fires a DOM event → we destroy the driver FIRST (removes the
    // overlay), THEN show the confirm dialog so nothing blocks it.
    useEffect(() => {
        const handler = () => {
            driverRef.current?.destroy();
            driverRef.current = null;
            setShowSkipConfirm(true);
        };
        document.addEventListener(SKIP_EVENT, handler);
        return () => document.removeEventListener(SKIP_EVENT, handler);
    }, []);

    const handleSkipConfirm = async () => {
        setShowSkipConfirm(false);
        await completeOnboarding(new Date().toISOString());
        onComplete();
    };

    const handleSkipCancel = () => {
        setShowSkipConfirm(false);
        setRetryKey((k) => k + 1);
    };

    useEffect(() => {
        let cancelled = false;

        if (step === 'highlight-new-program') {
            void runHighlightNewProgram();
        } else if (step === 'program-dashboard-tour') {
            void runDashboardTour();
        }

        return () => {
            cancelled = true;
            driverRef.current?.destroy();
            driverRef.current = null;
        };

        // ── Phase 1: spotlight "New Program", wait for user to click it ──────
        async function runHighlightNewProgram() {
            const driverFn = await loadDriver();
            if (cancelled) return;

            const d = driverFn({
                animate: true,
                overlayOpacity: 0.55,
                allowClose: false,
                allowKeyboardControl: false,
                // '__none__' is unknown to driver.js so the internal filter
                // produces E=[] and driver hides the footer; we re-show it
                // manually in onPopoverRender with only the step counter.
                showButtons: ['__none__'],
                popoverClass: getPopoverClass(),
                onPopoverRender: (popover: PopoverElements) => {
                    injectSkipCorner(popover.wrapper);
                    showCountOnlyFooter(popover, '1 of 5');
                },
                steps: [
                    {
                        element: '#onboarding-new-program-btn',
                        popover: {
                            title: 'Create your first Program',
                            description:
                                'A <strong>Program</strong> is your top-level workspace — it holds all your semesters and courses.' +
                                '<br><br><strong>👆 Click the button above to get started.</strong>',
                            side: 'bottom',
                            align: 'start',
                        },
                    },
                ],
            });

            driverRef.current = d;
            d.drive();

            // Capture-phase listener destroys the overlay before the button's own
            // click handler fires, so the dialog isn't obscured by the overlay.
            const el = document.getElementById('onboarding-new-program-btn');
            el?.addEventListener('click', () => {
                d.destroy();
                driverRef.current = null;
                // OnboardingController detects navigation to /programs/:id and
                // auto-advances step to 'program-dashboard-tour'.
            }, { once: true, capture: true });
        }

        // ── Phase 2: 4-step info sequence on the Program dashboard ───────────
        // Order: Plugins → Settings → Unassigned Courses → Add Semester (last)
        async function runDashboardTour() {
            const driverFn = await loadDriver();
            if (cancelled) return;

            const d = driverFn({
                animate: true,
                overlayOpacity: 0.5,
                allowClose: false,
                allowKeyboardControl: false,
                showProgress: true,
                showButtons: ['next', 'previous'],
                popoverClass: getPopoverClass(),
                nextBtnText: 'Next →',
                prevBtnText: '← Back',
                doneBtnText: "Let's start →",
                onPopoverRender: (popover: PopoverElements) => {
                    injectSkipCorner(popover.wrapper);
                },
                onDestroyStarted: (
                    _el: unknown,
                    _step: unknown,
                    { driver: d2 }: { driver: { isLastStep: () => boolean; destroy: () => void } }
                ) => {
                    if (d2.isLastStep()) {
                        d2.destroy();
                        setShowCelebration(true);
                        setTimeout(() => {
                            void completeOnboarding(new Date().toISOString()).finally(onComplete);
                        }, 2600);
                    } else {
                        d2.destroy();
                    }
                },
                steps: [
                    // Step 2 of 5 — Plugin System
                    {
                        popover: {
                            title: 'The Plugin System',
                            progressText: '2 of 5',
                            description: `
                                <p style="margin:0 0 10px;font-size:13px;line-height:1.6">
                                    Plugins extend what Semestra can do. Each plugin has a two-level lifecycle:
                                </p>
                                <div style="background:rgba(128,128,128,0.08);border-radius:8px;padding:10px 12px;font-size:12px;line-height:2">
                                    <div>📦 <strong>Install</strong> on a Program — makes the plugin available</div>
                                    <div>✅ <strong>Activate</strong> on a Semester — automatically applies to that Semester <em>and all its Courses</em></div>
                                </div>
                            `,
                        },
                    },
                    // Step 3 of 5 — Settings Inheritance
                    {
                        popover: {
                            title: 'Settings Inheritance',
                            progressText: '3 of 5',
                            description: `
                                <p style="margin:0 0 10px;font-size:13px;line-height:1.6">
                                    Settings like GPA scaling and course credits <strong>cascade</strong> down the hierarchy. Set once at a higher level — override only where needed.
                                </p>
                                <div style="background:rgba(128,128,128,0.08);border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.9">
                                    <div style="opacity:0.6">🎓 <strong>Program</strong> &nbsp;→&nbsp; default for all semesters</div>
                                    <div style="opacity:0.8">📅 <strong>Semester</strong> &nbsp;→&nbsp; inherits from Program, can override</div>
                                    <div style="font-weight:600">📚 <strong>Course</strong> &nbsp;→&nbsp; inherits from Semester, can override ✓</div>
                                </div>
                            `,
                        },
                    },
                    // Step 4 of 5 — Unassigned Courses
                    {
                        popover: {
                            title: 'Unassigned Courses',
                            progressText: '4 of 5',
                            description: `
                                <p style="margin:0 0 10px;font-size:13px;line-height:1.6">
                                    <strong>Unassigned Courses</strong> are courses added to this Program but not linked to any semester — useful for year-round or undecided courses.
                                </p>
                                <div style="background:rgba(128,128,128,0.08);border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.7">
                                    ⚠️ Some plugins require a semester context. Unassigned courses may have limited plugin support.
                                </div>
                            `,
                        },
                    },
                    // Step 5 of 5 — Add Semester (last — spotlight the button)
                    {
                        element: '#onboarding-new-semester-btn',
                        popover: {
                            title: 'Creating Semesters',
                            progressText: '5 of 5',
                            description:
                                'Semesters organize your courses by term. Click <strong>Add Semester</strong> whenever you\'re ready — a wizard will guide you through the setup.',
                            side: 'bottom',
                            align: 'start',
                        },
                        disableActiveInteraction: true,
                    },
                ],
            });

            driverRef.current = d;
            d.drive();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, retryKey]);

    return (
        <>
            <AlertDialog open={showSkipConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Skip the guided tour?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You can restart it at any time from Settings → Onboarding Tour.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleSkipCancel}>Continue tour</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void handleSkipConfirm()}>
                            Skip tour
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {showCelebration && (
                <div className="semestra-celebration-overlay">
                    <div className="semestra-celebration-card">
                        <div className="semestra-celebration-emoji">🎓</div>
                        <div className="semestra-celebration-title">You&apos;re all set!</div>
                        <div className="semestra-celebration-subtitle">Your first Program is ready. Let&apos;s build your semester.</div>
                    </div>
                </div>
            )}
        </>
    );
}
