// input:  [button state prop (`idle/saving/success/error`), customizable status labels, button props, and browser-timer-driven visual transitions]
// output: [`StatusButton` component and `StatusButtonState` type]
// pos:    [Reusable settings/action CTA with animated in-place status transitions]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useRef, useState } from "react";
import { Check, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type StatusButtonState = "idle" | "saving" | "success" | "error";

type StatusButtonVisualState =
  | "text"
  | "text-leaving"
  | "spinner-entering"
  | "spinner"
  | "spinner-leaving"
  | "check"
  | "text-entering";

const TEXT_OUT_MS = 180;
const SPINNER_DELAY_MS = 280;
const SPINNER_SWAP_MS = 180;
const TEXT_IN_MS = 200;

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

interface StatusButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "children"> {
  status: StatusButtonState;
  label: string;
  savingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  animated?: boolean;
}

export const StatusButton: React.FC<StatusButtonProps> = ({
  status,
  label,
  savingLabel = "Saving...",
  successLabel = "Saved",
  errorLabel = "Failed",
  animated = true,
  className,
  disabled,
  ...props
}) => {
  const [visualState, setVisualState] = useState<StatusButtonVisualState>("text");
  const previousStatusRef = useRef<StatusButtonState>(status);
  const savingStartedAtRef = useRef<number>(0);
  const spinnerShownRef = useRef(false);
  const timersRef = useRef<TimerHandle[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((timer) => globalThis.clearTimeout(timer));
    timersRef.current = [];
  };

  const schedule = (callback: () => void, delay: number) => {
    const timer = globalThis.setTimeout(callback, delay);
    timersRef.current.push(timer);
  };

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (!animated) {
      clearTimers();
      previousStatusRef.current = status;
      return;
    }

    const previousStatus = previousStatusRef.current;
    if (previousStatus === status) return;

    clearTimers();

    if (status === "saving") {
      savingStartedAtRef.current = Date.now();
      spinnerShownRef.current = false;
      setVisualState("text-leaving");
      schedule(() => {
        spinnerShownRef.current = true;
        setVisualState("spinner-entering");
      }, SPINNER_DELAY_MS);
      schedule(() => setVisualState("spinner"), SPINNER_DELAY_MS + SPINNER_SWAP_MS);
    } else if (status === "success") {
      const savingDuration = Date.now() - savingStartedAtRef.current;
      const isFastSave = savingDuration < SPINNER_DELAY_MS && !spinnerShownRef.current;
      const spinnerVisible =
        spinnerShownRef.current ||
        visualState === "spinner" ||
        visualState === "spinner-entering" ||
        visualState === "spinner-leaving";

      if (isFastSave) {
        const remainingTextExitMs = Math.max(0, TEXT_OUT_MS - savingDuration);
        if (remainingTextExitMs > 0) {
          schedule(() => setVisualState("check"), remainingTextExitMs);
        } else {
          setVisualState("check");
        }
      } else if (spinnerVisible) {
        setVisualState("spinner-leaving");
        schedule(() => setVisualState("check"), SPINNER_SWAP_MS);
      } else {
        setVisualState("check");
      }
    } else {
      spinnerShownRef.current = false;
      setVisualState("text-entering");
      schedule(() => setVisualState("text"), TEXT_IN_MS);
    }

    previousStatusRef.current = status;
  }, [animated, status, visualState]);

  const textVisible =
    visualState === "text" ||
    visualState === "text-leaving" ||
    visualState === "text-entering";

  const spinnerVisible =
    visualState === "spinner-entering" ||
    visualState === "spinner" ||
    visualState === "spinner-leaving";

  const visibleLabel =
    status === "saving"
      ? savingLabel
      : status === "success"
        ? successLabel
        : status === "error"
          ? errorLabel
          : label;
  const iconClassName = "size-4 shrink-0";

  if (!animated) {
    return (
      <Button
        disabled={disabled || status === "saving"}
        className={cn("min-w-[8.5rem]", className)}
        {...props}
      >
        <span className="sr-only" aria-live="polite">{visibleLabel}</span>
        <span aria-hidden className="inline-flex items-center gap-2">
          {status === "saving" ? <Spinner className={iconClassName} /> : null}
          {status === "success" ? <Check className={iconClassName} /> : null}
          {status === "error" ? <XCircle className={iconClassName} /> : null}
          <span>{visibleLabel}</span>
        </span>
      </Button>
    );
  }

  return (
    <Button
      disabled={disabled || status === "saving"}
      className={cn("min-w-[8.5rem]", className)}
      {...props}
    >
      <span className="sr-only" aria-live="polite">{visibleLabel}</span>

      <span
        aria-hidden
        className="relative grid h-5 min-w-[7rem] place-items-center overflow-hidden"
      >
        {textVisible && (
          <span
            className={cn(
              "col-start-1 row-start-1 whitespace-nowrap transition-all duration-200 ease-out",
              visualState === "text" && "opacity-100 translate-y-0",
              visualState === "text-leaving" && "opacity-0 -translate-y-2",
              visualState === "text-entering" &&
                "animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
            )}
          >
            {visibleLabel}
          </span>
        )}

        {spinnerVisible && (
          <Spinner
            className={cn(
              "col-start-1 row-start-1 size-4",
              visualState === "spinner-entering" &&
                "animate-in fade-in-0 slide-in-from-bottom-1 duration-200",
              visualState === "spinner" && "opacity-100",
              visualState === "spinner-leaving" &&
                "animate-out fade-out-0 slide-out-to-top-1 duration-200"
            )}
          />
        )}

        {visualState === "check" && (
          <Check className="col-start-1 row-start-1 size-4 text-current animate-in zoom-in-50 fade-in-0 duration-200" />
        )}
      </span>
    </Button>
  );
};
