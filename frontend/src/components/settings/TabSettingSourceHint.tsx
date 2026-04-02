// input:  [single setting source metadata, optional reset callback, and shared shadcn tooltip/icon-button primitives]
// output: [`TabSettingSourceHint` inline helper for title-adjacent source text and per-key reset actions]
// pos:    [small shared settings helper that surfaces current-scope overrides inline beside setting titles with layout-stable inline metrics and a chrome-free reset affordance]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React from 'react';
import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SettingSource } from '@/plugin-system/tabSettingsMeta';
import {
  getSettingResetLabel,
  getSettingLayerLabel,
} from '@/plugin-system/tabSettingsMeta';

interface TabSettingSourceHintProps {
  source: SettingSource;
  onReset?: () => void | Promise<void>;
}

export const TabSettingSourceHint: React.FC<TabSettingSourceHintProps> = ({
  source,
  onReset,
}) => {
  if (!source.is_overridden_in_scope) {
    return null;
  }

  const sourceLabel = `Modified in ${getSettingLayerLabel(source.effective_layer)}`;

  return (
    <span className="inline-flex h-4 shrink-0 items-center gap-1.5 whitespace-nowrap align-middle text-[11px] leading-none font-normal text-muted-foreground">
      <span className="leading-none">{sourceLabel}</span>
      {onReset ? (
        <TooltipProvider delayDuration={120}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-4 shrink-0 rounded-none bg-transparent p-0 text-muted-foreground shadow-none transition-colors hover:bg-transparent hover:text-foreground focus-visible:bg-transparent active:bg-transparent"
                onClick={() => {
                  void Promise.resolve(onReset());
                }}
              >
                <RotateCcw className="size-3" />
                <span className="sr-only">{getSettingResetLabel(source)}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
              {getSettingResetLabel(source)}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </span>
  );
};
