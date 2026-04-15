// input:  [React children, variant (widget | tab), optional label and onRemove callback]
// output: [`PluginErrorBoundary` class component that catches plugin render errors and shows an in-place fallback UI]
// pos:    [Error isolation boundary for plugin widgets and tabs; prevents a plugin render crash from propagating to the app shell]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';

import { AppEmptyState } from '@/components/AppEmptyState';
import { Button } from '@/components/ui/button';

export interface PluginErrorBoundaryProps {
    children: React.ReactNode;
    variant: 'widget' | 'tab';
    /** widget.type or tab.title — shown in the error message */
    label?: string;
    /** Only used for widget variant: callback to delete the crashed widget */
    onRemove?: () => void;
}

interface PluginErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class PluginErrorBoundary extends React.Component<
    PluginErrorBoundaryProps,
    PluginErrorBoundaryState
> {
    constructor(props: PluginErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): PluginErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        const { variant, label } = this.props;
        console.error(
            `[plugin-system] ${variant} component crashed${label ? ` (${label})` : ''}:`,
            error,
            info.componentStack,
        );
    }

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }
        if (this.props.variant === 'widget') {
            return <WidgetErrorFallback label={this.props.label} onRemove={this.props.onRemove} />;
        }
        return <TabErrorFallback label={this.props.label} />;
    }
}

// ---------------------------------------------------------------------------
// Internal fallback UIs — not exported
// ---------------------------------------------------------------------------

const WidgetErrorFallback: React.FC<{ label?: string; onRemove?: () => void }> = ({
    label,
    onRemove,
}) => (
    <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-muted-foreground bg-muted/20">
        <div className="rounded-full bg-destructive/10 p-3 mb-3">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6 text-destructive"
            >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
            </svg>
        </div>
        <h3 className="mb-1 font-semibold text-foreground">Widget Crashed</h3>
        <p className="mb-4 text-xs text-muted-foreground/80 line-clamp-2">
            {label ? `${label} encountered a runtime error.` : 'This widget encountered a runtime error.'}
        </p>
        {onRemove && (
            <Button variant="destructive" size="sm" onClick={onRemove}>
                Delete Widget
            </Button>
        )}
    </div>
);

const TabErrorFallback: React.FC<{ label?: string }> = ({ label }) => (
    <AppEmptyState
        scenario="unavailable"
        size="section"
        title="Tab Crashed"
        description={label ? `${label} encountered a runtime error.` : 'This tab encountered a runtime error.'}
    />
);
