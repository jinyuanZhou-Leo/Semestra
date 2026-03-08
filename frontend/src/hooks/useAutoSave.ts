// input:  [current draft value, saved snapshot value, async save callback, optional equality/validation/timing config]
// output: [`useAutoSave()` hook exposing save state and pending-change status for auto-saving forms]
// pos:    [Cross-page auto-save scheduler with debounce, max-wait throttling, and save-state feedback]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useCallback, useEffect, useRef, useState } from "react";

export type AutoSaveState = "idle" | "saving" | "success";

interface UseAutoSaveOptions<T> {
  value: T;
  savedValue: T;
  onSave: (value: T) => Promise<void>;
  isEqual?: (a: T, b: T) => boolean;
  validate?: (value: T) => boolean;
  debounceMs?: number;
  maxWaitMs?: number;
  successMs?: number;
  enabled?: boolean;
  onError?: (error: unknown) => void | Promise<void>;
}

const DEFAULT_DEBOUNCE_MS = 900;
const DEFAULT_MAX_WAIT_MS = 4000;
const DEFAULT_SUCCESS_MS = 900;

export const useAutoSave = <T>({
  value,
  savedValue,
  onSave,
  isEqual = Object.is,
  validate,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  maxWaitMs = DEFAULT_MAX_WAIT_MS,
  successMs = DEFAULT_SUCCESS_MS,
  enabled = true,
  onError,
}: UseAutoSaveOptions<T>) => {
  const [saveState, setSaveState] = useState<AutoSaveState>("idle");

  const latestValueRef = useRef(value);
  const latestSavedValueRef = useRef(savedValue);
  const acknowledgedSavedValueRef = useRef(savedValue);
  const debounceTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const pendingSinceRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const shouldRetryAfterSaveRef = useRef(false);

  latestValueRef.current = value;
  latestSavedValueRef.current = savedValue;

  useEffect(() => {
    acknowledgedSavedValueRef.current = savedValue;
  }, [savedValue]);

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const clearSuccessTimer = useCallback(() => {
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }, []);

  const hasPendingChanges =
    enabled && !isEqual(latestValueRef.current, acknowledgedSavedValueRef.current);
  const isValid = validate ? validate(latestValueRef.current) : true;

  const runSave = useCallback(async () => {
    if (!enabled) return;
    if (!isValid) return;
    if (isEqual(latestValueRef.current, acknowledgedSavedValueRef.current)) return;

    if (isSavingRef.current) {
      shouldRetryAfterSaveRef.current = true;
      return;
    }

    clearDebounceTimer();
    clearSuccessTimer();
    pendingSinceRef.current = null;
    shouldRetryAfterSaveRef.current = false;
    isSavingRef.current = true;
    setSaveState("saving");

    const snapshot = latestValueRef.current;

    try {
      await onSave(snapshot);
      acknowledgedSavedValueRef.current = snapshot;
      setSaveState("success");
      clearSuccessTimer();
      successTimerRef.current = window.setTimeout(() => {
        setSaveState("idle");
      }, successMs);
    } catch (error) {
      setSaveState("idle");
      await onError?.(error);
    } finally {
      isSavingRef.current = false;

      if (
        shouldRetryAfterSaveRef.current &&
        !isEqual(latestValueRef.current, acknowledgedSavedValueRef.current)
      ) {
        shouldRetryAfterSaveRef.current = false;
        pendingSinceRef.current = Date.now();
        void runSave();
      }
    }
  }, [
    clearDebounceTimer,
    clearSuccessTimer,
    enabled,
    isEqual,
    isValid,
    onError,
    onSave,
    successMs,
  ]);

  useEffect(() => {
    if (!enabled) {
      clearDebounceTimer();
      pendingSinceRef.current = null;
      setSaveState("idle");
      return;
    }

    if (!hasPendingChanges) {
      clearDebounceTimer();
      pendingSinceRef.current = null;
      return;
    }

    if (!isValid) {
      clearDebounceTimer();
      return;
    }

    const now = Date.now();
    if (pendingSinceRef.current === null) {
      pendingSinceRef.current = now;
    }

    const elapsedMs = now - pendingSinceRef.current;
    const remainingBeforeForceSave = Math.max(0, maxWaitMs - elapsedMs);
    const delayMs = Math.min(debounceMs, remainingBeforeForceSave);

    clearDebounceTimer();
    debounceTimerRef.current = window.setTimeout(() => {
      void runSave();
    }, delayMs);

    return clearDebounceTimer;
  }, [
    clearDebounceTimer,
    debounceMs,
    enabled,
    hasPendingChanges,
    isValid,
    maxWaitMs,
    runSave,
  ]);

  useEffect(() => {
    return () => {
      clearDebounceTimer();
      clearSuccessTimer();
    };
  }, [clearDebounceTimer, clearSuccessTimer]);

  return {
    saveState,
    hasPendingChanges,
    isValid,
  };
};
