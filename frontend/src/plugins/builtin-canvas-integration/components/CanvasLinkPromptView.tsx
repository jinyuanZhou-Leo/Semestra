// input:  [Canvas tab labels/URLs, semantic copy, shared empty-state wrapper, and shadcn button primitive]
// output: [CanvasLinkPromptView presentational component for external-launch and unsupported-tab CTA states]
// pos:    [generic CTA-only renderer for Canvas tabs that should open outside Semestra instead of rendering embedded content]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { ExternalLink } from 'lucide-react';

import { AppEmptyState } from '@/components/AppEmptyState';
import { Button } from '@/components/ui/button';

export const CanvasLinkPromptView: React.FC<{
    title: string;
    description: string;
    href?: string | null;
    buttonLabel: string;
}> = ({ title, description, href, buttonLabel }) => (
    <AppEmptyState
        scenario="unavailable"
        size="section"
        surface="inherit"
        title={title}
        description={description}
        primaryAction={href ? (
            <Button asChild variant="outline" size="sm">
                <a href={href} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" />
                    {buttonLabel}
                </a>
            </Button>
        ) : undefined}
        className="h-full"
    />
);
