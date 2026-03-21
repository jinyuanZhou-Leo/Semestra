// input:  [current draft value, saved snapshot value, async save callback, optional equality/validation/timing config, and shared timer handles]
// output: [`useAutoSave()` hook exposing save state, pending-change status, and a manual flush action for auto-saving forms]
// pos:    [Cross-page auto-save scheduler with debounce, max-wait throttling, save-state feedback, and retry pause after failed saves until the draft changes]
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

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Object.prototype.toString.call(value) === "[object Object]"
);

const defaultIsEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    return left.every((entry, index) => defaultIsEqual(entry, right[index]));
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;

    return leftKeys.every((key) => (
      Object.prototype.hasOwnProperty.call(right, key)
      && defaultIsEqual(left[key], right[key])
    ));
  }

  return false;
};

export const useAutoSave = <T>({
  value,
  savedValue,
  onSave,
  isEqual = defaultIsEqual as (a: T, b: T) => boolean,
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
  const debounceTimerRef = useRef<TimerHandle | null>(null);
  const successTimerRef = useRef<TimerHandle | null>(null);
  const pendingSinceRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const shouldRetryAfterSaveRef = useRef(false);
  const failedValueRef = useRef<T | null>(null);

  latestValueRef.current = value;
  latestSavedValueRef.current = savedValue;

  useEffect(() => {
    acknowledgedSavedValueRef.current = savedValue;
    if (isEqual(latestValueRef.current, savedValue)) {
      failedValueRef.current = null;
    }
  }, [savedValue]);

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current) {
      globalThis.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const clearSuccessTimer = useCallback(() => {
    if (successTimerRef.current) {
      globalThis.clearTimeout(successTimerRef.current);
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
      failedValueRef.current = null;
      setSaveState("success");
      clearSuccessTimer();
      successTimerRef.current = globalThis.setTimeout(() => {
        setSaveState("idle");
      }, successMs);
    } catch (error) {
      failedValueRef.current = snapshot;
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
      failedValueRef.current = null;
      return;
    }

    if (!isValid) {
      clearDebounceTimer();
      return;
    }

    if (failedValueRef.current && isEqual(latestValueRef.current, failedValueRef.current)) {
      clearDebounceTimer();
      pendingSinceRef.current = null;
      return;
    }

    failedValueRef.current = null;

    const now = Date.now();
    if (pendingSinceRef.current === null) {
      pendingSinceRef.current = now;
    }

    const elapsedMs = now - pendingSinceRef.current;
    const remainingBeforeForceSave = Math.max(0, maxWaitMs - elapsedMs);
    const delayMs = Math.min(debounceMs, remainingBeforeForceSave);

    clearDebounceTimer();
    debounceTimerRef.current = globalThis.setTimeout(() => {
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
    value,
    savedValue,
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
    flush: runSave,
  };
};
