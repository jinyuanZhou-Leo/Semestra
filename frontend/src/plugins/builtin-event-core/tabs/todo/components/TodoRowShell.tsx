// input:  [Todo row mode, shared row slots, local class overrides, and optional content refs]
// output: [TodoRowMode type, shared todo row shell, and row typography class constants]
// pos:    [Shared presentation scaffold that keeps inline create and task rows on one aligned layout contract]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React from 'react';
import { cn } from '@/lib/utils';

export type TodoRowMode = 'placeholder' | 'creating' | 'view' | 'editing';

export const TODO_ROW_TITLE_CLASSNAME = 'block h-auto max-w-full border-0 bg-transparent p-0 text-[16px] font-medium leading-6 outline-none';
export const TODO_ROW_NOTE_CLASSNAME = 'block h-auto max-w-full border-0 bg-transparent p-0 text-[14px] leading-[1.25] outline-none';

interface TodoRowShellProps extends React.HTMLAttributes<HTMLDivElement> {
  mode: TodoRowMode;
  leading: React.ReactNode;
  trailing?: React.ReactNode;
  contentRef?: React.Ref<HTMLDivElement>;
  contentClassName?: string;
}

export const TodoRowShell = React.forwardRef<HTMLDivElement, TodoRowShellProps>(({
  mode,
  leading,
  trailing,
  children,
  className,
  contentRef,
  contentClassName,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      data-todo-row-mode={mode}
      className={cn(
        'rounded-[18px] px-3 py-2.5 sm:px-2',
        mode === 'placeholder' && 'text-muted-foreground transition-colors hover:bg-muted/25 hover:text-foreground',
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        {leading}
        <div ref={contentRef} className={cn('min-w-0 flex-1 space-y-0.5', contentClassName)}>
          {children}
        </div>
        {trailing}
      </div>
    </div>
  );
});

TodoRowShell.displayName = 'TodoRowShell';
