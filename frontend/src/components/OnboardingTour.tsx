// input:  [driver.js tour library, auth context completeOnboarding]
// output: [OnboardingTour component that runs a 6-step conceptual introduction on first mount]
// pos:    [Mounted by OnboardingController in App.tsx for first-time users with no active program]

import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
    onComplete: () => void;
}

const STEPS = [
    {
        title: 'Welcome to Semestra',
        description: `
            <p style="margin:0 0 10px;font-size:13px;line-height:1.6">
                Semestra helps you manage your full academic journey — from degree programs down to individual assignments.
            </p>
            <div style="display:flex;gap:6px;align-items:center;justify-content:center;background:rgba(128,128,128,0.08);border-radius:8px;padding:10px 14px;font-size:12px;font-weight:500">
                <span>🎓&nbsp;Program</span>
                <span style="opacity:0.4;font-weight:300">→</span>
                <span>📅&nbsp;Semester</span>
                <span style="opacity:0.4;font-weight:300">→</span>
                <span>📚&nbsp;Course</span>
            </div>
        `,
    },
    {
        title: 'Programs — your top-level workspaces',
        description: `
            <p style="margin:0 0 10px;font-size:13px;line-height:1.6">
                A <strong>Program</strong> represents a degree or academic program. It owns all your semesters, controls GPA scaling, manages subject color coding, and connects to your LMS.
            </p>
            <p style="margin:0;font-size:12px;line-height:1.5;opacity:0.65">
                💡 You can create multiple Programs — useful if you're pursuing a double degree or a certificate alongside your main program.
            </p>
        `,
    },
    {
        title: 'Semesters & Courses',
        description: `
            <p style="margin:0 0 10px;font-size:13px;line-height:1.6">
                Each <strong>Semester</strong> is a time-bounded term under a Program. Add <strong>Courses</strong> to a Semester to track grades, assignments, and resources — all in one place.
            </p>
            <div style="background:rgba(128,128,128,0.08);border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.9">
                <div style="font-weight:600">📅 Fall 2024 <span style="opacity:0.45;font-weight:400;font-size:11px">&nbsp;Sep – Dec</span></div>
                <div style="margin-left:14px;opacity:0.7;font-size:11px">📚 Intro to CS &nbsp;·&nbsp; 📚 Calculus I &nbsp;·&nbsp; 📚 Physics</div>
            </div>
        `,
    },
    {
        title: 'The Plugin System',
        description: `
            <p style="margin:0 0 10px;font-size:13px;line-height:1.6">
                Plugins extend what Semestra can do. Each plugin has a three-level lifecycle:
            </p>
            <div style="background:rgba(128,128,128,0.08);border-radius:8px;padding:10px 12px;font-size:12px;line-height:2">
                <div>📦 <strong>Install</strong> on a Program — makes the plugin available</div>
                <div>✅ <strong>Activate</strong> per Semester — turns it on for that term</div>
                <div>⚙️ <strong>Enable</strong> per Course — applies to a specific course</div>
            </div>
        `,
    },
    {
        title: 'Dashboards & Widgets',
        description: `
            <p style="margin:0 0 10px;font-size:13px;line-height:1.6">
                Every Semester has a customizable <strong>Dashboard</strong> — a grid where you add, resize, and rearrange <strong>widgets</strong> provided by your active plugins. Tabs also come from plugins.
            </p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;text-align:center">
                <div style="background:rgba(128,128,128,0.08);border-radius:6px;padding:8px 6px">📊 Gradebook</div>
                <div style="background:rgba(128,128,128,0.08);border-radius:6px;padding:8px 6px">📅 Calendar</div>
                <div style="background:rgba(128,128,128,0.08);border-radius:6px;padding:8px 6px">⏱️ Pomodoro</div>
                <div style="background:rgba(128,128,128,0.08);border-radius:6px;padding:8px 6px">📌 Sticky Note</div>
            </div>
        `,
    },
    {
        title: 'Settings Inheritance',
        description: `
            <p style="margin:0 0 10px;font-size:13px;line-height:1.6">
                Settings like GPA scaling and course credits <strong>cascade</strong> down the hierarchy. Set it once at the Program level — override only where needed.
            </p>
            <div style="background:rgba(128,128,128,0.08);border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.9">
                <div style="opacity:0.5">🌐 App default &nbsp;→&nbsp; 4.0 scale</div>
                <div style="opacity:0.75">👤 Your setting &nbsp;→&nbsp; 4.0 scale</div>
                <div style="font-weight:600">🎓 Program setting &nbsp;→&nbsp; custom ✓</div>
            </div>
        `,
    },
];

export function OnboardingTour({ onComplete }: Props) {
    const { completeOnboarding } = useAuth();

    useEffect(() => {
        const driverObj = driver({
            animate: true,
            overlayOpacity: 0.45,
            allowClose: false,
            allowKeyboardControl: false,
            showProgress: true,
            showButtons: ['next', 'previous'],
            popoverClass: 'semestra-onboarding',
            nextBtnText: 'Next →',
            prevBtnText: '← Back',
            doneBtnText: 'Get started →',
            onPopoverRender: (popover, { driver: d }) => {
                const skipBtn = document.createElement('button');
                skipBtn.textContent = 'Skip tour';
                skipBtn.className = 'semestra-onboarding-skip';
                popover.footer.insertBefore(skipBtn, popover.footer.firstChild);
                skipBtn.addEventListener('click', () => d.destroy());
            },
            onDestroyStarted: (_el, _step, { driver: d }) => {
                d.destroy();
                void completeOnboarding(new Date().toISOString()).finally(onComplete);
            },
            steps: STEPS.map((s) => ({
                popover: { title: s.title, description: s.description },
            })),
        });

        driverObj.drive();

        return () => {
            if (driverObj.isActive()) {
                driverObj.destroy();
            }
        };
    // The effect should run exactly once on mount; stable refs from useCallback/useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
}
