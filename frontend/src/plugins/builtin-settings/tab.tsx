"use no memo";

import React from 'react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Puzzle } from 'lucide-react';

import { SettingsStickyTopProvider } from '../../components/SettingsSection';
import { useBuiltinTabContext } from '../../contexts/BuiltinTabContext';
import type { TabDefinition, TabProps } from '../../services/tabRegistry';

const SETTINGS_TAB_STICKY_TOP = 185; // 60px nav + ~101px hero (shrunk) + 24px gap
const BuiltinSettingsTabComponent: React.FC<TabProps> = () => {
    const { isLoading, settings } = useBuiltinTabContext();

    if (isLoading) {
        return <div className="p-8 text-muted-foreground">Loading…</div>;
    }

    return (
        <SettingsStickyTopProvider value={SETTINGS_TAB_STICKY_TOP}>
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
    name: 'Settings',
    component: BuiltinSettingsTab,
    maxInstances: 1,
    allowedContexts: ['semester', 'course']
};
