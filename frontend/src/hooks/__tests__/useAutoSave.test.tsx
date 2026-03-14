// input:  [React testing-library hook helpers, fake timers, and `useAutoSave` hook]
// output: [regression tests for object equality, latest-value debounce behavior, and pause-after-error behavior in `useAutoSave`]
// pos:    [Hook-level autosave tests guarding settings forms against stalled, repeated, or stale retries]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAutoSave } from "../useAutoSave";

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not treat structurally-equal object snapshots as dirty", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const snapshot = { name: "APS105", category: "APS" };

    renderHook(() => useAutoSave({
      value: { ...snapshot },
      savedValue: { ...snapshot },
      onSave,
      debounceMs: 50,
      successMs: 50,
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves the latest draft after debounce resets across rapid input changes", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ value, savedValue }: { value: { name: string }; savedValue: { name: string } }) => useAutoSave({
        value,
        savedValue,
        onSave,
        debounceMs: 200,
        maxWaitMs: 1000,
        successMs: 50,
      }),
      {
        initialProps: {
          value: { name: "A" },
          savedValue: { name: "" },
        },
      },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    rerender({
      value: { name: "AP" },
      savedValue: { name: "" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    rerender({
      value: { name: "APS" },
      savedValue: { name: "" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(199);
    });

    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenLastCalledWith({ name: "APS" });
  });

  it("does not retry a failed auto-save until the draft changes again", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("network"));
    const { rerender } = renderHook(
      ({ value, savedValue }: { value: { name: string }; savedValue: { name: string } }) => useAutoSave({
        value,
        savedValue,
        onSave,
        debounceMs: 50,
        maxWaitMs: 200,
        successMs: 50,
      }),
      {
        initialProps: {
          value: { name: "APS" },
          savedValue: { name: "" },
        },
      },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(1);

    rerender({
      value: { name: "APS1" },
      savedValue: { name: "" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith({ name: "APS1" });
  });
});
