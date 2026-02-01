import React from 'react';

export interface TabProps {
    tabId: string;
    settings: any;
    semesterId?: string;
    courseId?: string;
    updateSettings: (newSettings: any) => void | Promise<void>;
    title?: string;
    pluginName?: string;
}

export interface TabSettingsProps {
    tabId: string;
    settings: any;
    semesterId?: string;
    courseId?: string;
    updateSettings: (newSettings: any) => void | Promise<void>;
}

export interface TabLifecycleContext {
    tabId: string;
    semesterId?: string;
    courseId?: string;
    settings: any;
}

export type TabContext = 'semester' | 'course';
export type MaxInstances = number | 'unlimited';

export interface TabDefinition {
    type: string;
    name: string;
    description?: string;
    icon?: React.ReactNode;
    component: React.FC<TabProps>;
    settingsComponent?: React.FC<TabSettingsProps>;
    defaultSettings?: any;
    maxInstances?: MaxInstances;
    allowedContexts?: TabContext[];
    onCreate?: (context: TabLifecycleContext) => Promise<void> | void;
    onDelete?: (context: TabLifecycleContext) => Promise<void> | void;
}

class TabRegistryClass {
    private tabs: Map<string, TabDefinition> = new Map();
    private memoizedComponents: Map<string, React.FC<TabProps>> = new Map();
    private memoizedSettingsComponents: Map<string, React.FC<TabSettingsProps>> = new Map();

    register(definition: TabDefinition) {
        if (this.tabs.has(definition.type)) {
            console.warn(`Tab type ${definition.type} is already registered. Overwriting.`);
            // Clear cached memoized components when re-registering
            this.memoizedComponents.delete(definition.type);
            this.memoizedSettingsComponents.delete(definition.type);
        }
        this.tabs.set(definition.type, definition);
    }

    get(type: string): TabDefinition | undefined {
        return this.tabs.get(type);
    }

    getAll(): TabDefinition[] {
        return Array.from(this.tabs.values());
    }

    getComponent(type: string): React.FC<TabProps> | undefined {
        const definition = this.tabs.get(type);
        if (!definition) return undefined;

        // Return cached memoized component if available
        if (this.memoizedComponents.has(type)) {
            return this.memoizedComponents.get(type);
        }

        // Create memoized version with custom comparison
        const MemoizedComponent = React.memo(definition.component, (prevProps, nextProps) => {
            // Only re-render if these specific props change
            return (
                prevProps.tabId === nextProps.tabId &&
                prevProps.semesterId === nextProps.semesterId &&
                prevProps.courseId === nextProps.courseId &&
                JSON.stringify(prevProps.settings) === JSON.stringify(nextProps.settings)
            );
        });

        // Cache and return
        this.memoizedComponents.set(type, MemoizedComponent);
        return MemoizedComponent;
    }

    getSettingsComponent(type: string): React.FC<TabSettingsProps> | undefined {
        const definition = this.tabs.get(type);
        if (!definition?.settingsComponent) return undefined;

        // Return cached memoized settings component if available
        if (this.memoizedSettingsComponents.has(type)) {
            return this.memoizedSettingsComponents.get(type);
        }

        // Create memoized version
        const MemoizedSettingsComponent = React.memo(definition.settingsComponent, (prevProps, nextProps) => {
            return (
                prevProps.tabId === nextProps.tabId &&
                prevProps.semesterId === nextProps.semesterId &&
                prevProps.courseId === nextProps.courseId &&
                JSON.stringify(prevProps.settings) === JSON.stringify(nextProps.settings)
            );
        });

        // Cache and return
        this.memoizedSettingsComponents.set(type, MemoizedSettingsComponent);
        return MemoizedSettingsComponent;
    }
}

const DEFAULT_ALLOWED_CONTEXTS: TabContext[] = ['semester', 'course'];

export const resolveAllowedContexts = (definition: TabDefinition) => {
    return definition.allowedContexts ?? DEFAULT_ALLOWED_CONTEXTS;
};

export const isUnlimitedInstances = (maxInstances?: MaxInstances) => {
    if (maxInstances === undefined || maxInstances === 'unlimited') return true;
    if (typeof maxInstances === 'number' && !Number.isFinite(maxInstances)) return true;
    return false;
};

export const canAddTab = (definition: TabDefinition, context: TabContext, currentCount: number) => {
    if (!resolveAllowedContexts(definition).includes(context)) return false;
    if (isUnlimitedInstances(definition.maxInstances)) return true;
    if (typeof definition.maxInstances === 'number') return currentCount < definition.maxInstances;
    return true;
};

export const TabRegistry = new TabRegistryClass();
