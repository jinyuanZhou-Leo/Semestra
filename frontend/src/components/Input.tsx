import React, { type InputHTMLAttributes, useId } from "react";
import { Input as UiInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  wrapperStyle?: React.CSSProperties;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, style, wrapperStyle, rightElement, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? (label ? `input-${generatedId}` : undefined);

    return (
      <div
        className="flex flex-col gap-2 mb-4"
        style={{ ...wrapperStyle }}
      >
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-muted-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <UiInput
            ref={ref}
            id={inputId}
            className={cn(rightElement && "pr-10", className)}
            style={style}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 flex items-center text-muted-foreground">
              {rightElement}
            </div>
          )}
        </div>
      </div>
    );
  }
);

Input.displayName = "Input";
