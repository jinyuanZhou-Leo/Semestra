import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type SaveButtonState = "idle" | "saving" | "success";

type SaveButtonVisualState =
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

interface SaveSettingButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "children"> {
  saveState: SaveButtonState;
  label?: string;
  animated?: boolean;
}

export const SaveSettingButton: React.FC<SaveSettingButtonProps> = ({
  saveState,
  label = "Save Settings",
  animated = true,
  className,
  disabled,
  ...props
}) => {
  const [visualState, setVisualState] = useState<SaveButtonVisualState>("text");
  const previousSaveStateRef = useRef<SaveButtonState>(saveState);
  const savingStartedAtRef = useRef<number>(0);
  const spinnerShownRef = useRef(false);
  const timersRef = useRef<Array<ReturnType<typeof window.setTimeout>>>([]);

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
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
      previousSaveStateRef.current = saveState;
      return;
    }

    const previousSaveState = previousSaveStateRef.current;
    if (previousSaveState === saveState) return;

    clearTimers();

    if (saveState === "saving") {
      savingStartedAtRef.current = Date.now();
      spinnerShownRef.current = false;
      setVisualState("text-leaving");
      schedule(() => {
        spinnerShownRef.current = true;
        setVisualState("spinner-entering");
      }, SPINNER_DELAY_MS);
      schedule(() => setVisualState("spinner"), SPINNER_DELAY_MS + SPINNER_SWAP_MS);
    } else if (saveState === "success") {
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

    previousSaveStateRef.current = saveState;
  }, [saveState, visualState, animated]);

  const textVisible =
    visualState === "text" ||
    visualState === "text-leaving" ||
    visualState === "text-entering";

  const spinnerVisible =
    visualState === "spinner-entering" ||
    visualState === "spinner" ||
    visualState === "spinner-leaving";

  if (!animated) {
    const plainLabel =
      saveState === "saving"
        ? "Saving..."
        : saveState === "success"
          ? "Saved"
          : label;

    return (
      <Button
        disabled={disabled || saveState === "saving"}
        className={cn("min-w-[8.5rem]", className)}
        {...props}
      >
        <span className="sr-only" aria-live="polite">
          {saveState === "saving"
            ? "Saving settings"
            : saveState === "success"
              ? "Settings saved"
              : label}
        </span>
        <span aria-hidden>{plainLabel}</span>
      </Button>
    );
  }

  return (
    <Button
      disabled={disabled || saveState === "saving"}
      className={cn("min-w-[8.5rem]", className)}
      {...props}
    >
      <span className="sr-only" aria-live="polite">
        {saveState === "saving"
          ? "Saving settings"
          : saveState === "success"
            ? "Settings saved"
            : label}
      </span>

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
            {label}
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
