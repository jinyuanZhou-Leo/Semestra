// input:  [built-in settings tab context, sticky title offset provider, and shared UI primitives]
// output: [`BuiltinSettingsTab` runtime and tab definition export]
// pos:    [settings-tab entry that injects a live sticky offset so section titles stay clear of the workspace header]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Puzzle } from 'lucide-react';

import { SettingsStickyTopProvider } from '../../components/SettingsSection';
import { useBuiltinTabContext } from '../../contexts/BuiltinTabContext';
import type { TabDefinition, TabProps } from '../../services/tabRegistry';

const GLOBAL_HEADER_HEIGHT = 60;
const SETTINGS_TITLE_GAP = 24;
const FALLBACK_WORKSPACE_NAV_HEIGHT = 104;

const BuiltinSettingsTabComponent: React.FC<TabProps> = () => {
    const { isLoading, settings } = useBuiltinTabContext();
    const [stickyTop, setStickyTop] = React.useState(
        GLOBAL_HEADER_HEIGHT + FALLBACK_WORKSPACE_NAV_HEIGHT + SETTINGS_TITLE_GAP,
    );

    React.useEffect(() => {
        if (typeof window === 'undefined') return;

        let frameId: number | null = null;
        let resizeObserver: ResizeObserver | null = null;

        const updateStickyTop = () => {
            const header = document.querySelector<HTMLElement>('.sticky-page-header');
            const workspaceHeaderHeight = header
                ? Math.ceil(header.getBoundingClientRect().height)
                : FALLBACK_WORKSPACE_NAV_HEIGHT;
            setStickyTop(GLOBAL_HEADER_HEIGHT + workspaceHeaderHeight + SETTINGS_TITLE_GAP);
        };

        const scheduleUpdate = () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
            frameId = window.requestAnimationFrame(() => {
                frameId = null;
                updateStickyTop();
            });
        };

        const header = document.querySelector<HTMLElement>('.sticky-page-header');
        if (header && typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(scheduleUpdate);
            resizeObserver.observe(header);
        }

        window.addEventListener('resize', scheduleUpdate);
        scheduleUpdate();

        return () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
            resizeObserver?.disconnect();
            window.removeEventListener('resize', scheduleUpdate);
        };
    }, []);

    if (isLoading) {
        return <div className="p-8 text-muted-foreground">Loading…</div>;
    }

    return (
        <SettingsStickyTopProvider value={stickyTop}>
            <div className="w-full space-y-6 select-none font-sans py-4 pb-12">
                {settings.content}
                {settings.extraSections && (
                    <>
                        <div className="py-2">
                            <Separator />
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <Badge variant="secondary" className="uppercase tracking-wide text-[10px] text-muted-foreground font-semibold">
                                <Puzzle className="h-3 w-3 mr-1" />
                                Plugins
                            </Badge>
                            <span className="text-xs text-muted-foreground/80">Settings provided by active plugins</span>
                        </div>
                        {settings.extraSections}
                    </>
                )}
            </div>
        </SettingsStickyTopProvider>
    );
};

export const BuiltinSettingsTab = BuiltinSettingsTabComponent;

export const BuiltinSettingsTabDefinition: TabDefinition = {
    type: 'settings',
    component: BuiltinSettingsTab,
};
