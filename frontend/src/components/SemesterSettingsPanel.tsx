// input:  [semester initial fields, shared Semester basics fields, and debounced auto-save callback]
// output: [`SemesterSettingsPanel` component]
// pos:    [Semester settings form that reuses the shared shadcn Semester basics fields so settings and wizard flows stay on one date-picker and Reading Week validation implementation]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  getSemesterBasicsValidation,
  SemesterBasicsFields,
  type SemesterBasicsValue,
} from "@/components/SemesterBasicsFields";
import { FieldSet } from "@/components/ui/field";
import { useAutoSave } from "@/hooks/useAutoSave";

import { SettingsSection } from "./SettingsSection";

interface SemesterSettingsPanelProps {
  initialName: string;
  initialSettings: {
    start_date?: string;
    end_date?: string;
    reading_week_start?: string | null;
    reading_week_end?: string | null;
  };
  onSave: (data: {
    name: string;
    start_date: string | null;
    end_date: string | null;
    reading_week_start: string | null;
    reading_week_end: string | null;
  }) => Promise<void>;
  registerFlush?: (flush: () => Promise<void>) => void;
}

const buildSemesterDraft = (
  initialName: string,
  initialSettings: SemesterSettingsPanelProps["initialSettings"],
): SemesterBasicsValue => ({
  name: initialName,
  start_date: initialSettings.start_date ?? "",
  end_date: initialSettings.end_date ?? "",
  reading_week_start: initialSettings.reading_week_start ?? "",
  reading_week_end: initialSettings.reading_week_end ?? "",
});

const areSemesterDraftsEqual = (left: SemesterBasicsValue, right: SemesterBasicsValue) => {
  return left.name === right.name
    && left.start_date === right.start_date
    && left.end_date === right.end_date
    && left.reading_week_start === right.reading_week_start
    && left.reading_week_end === right.reading_week_end;
};

export const SemesterSettingsPanel: React.FC<SemesterSettingsPanelProps> = ({
  initialName,
  initialSettings,
  onSave,
  registerFlush,
}) => {
  const [draft, setDraft] = useState<SemesterBasicsValue>(() => buildSemesterDraft(initialName, initialSettings));
  const savedSnapshot = useMemo(
    () => buildSemesterDraft(initialName, initialSettings),
    [
      initialName,
      initialSettings.end_date,
      initialSettings.reading_week_end,
      initialSettings.reading_week_start,
      initialSettings.start_date,
    ],
  );
  const lastLoadedSnapshotRef = useRef(savedSnapshot);
  const validation = useMemo(
    () => getSemesterBasicsValidation(draft),
    [draft.end_date, draft.reading_week_end, draft.reading_week_start, draft.start_date],
  );

  useEffect(() => {
    const previousSnapshot = lastLoadedSnapshotRef.current;
    const externalChanged = !areSemesterDraftsEqual(previousSnapshot, savedSnapshot);
    const draftHasLocalChanges = !areSemesterDraftsEqual(previousSnapshot, draft);
    const incomingMatchesDraft = areSemesterDraftsEqual(savedSnapshot, draft);

    lastLoadedSnapshotRef.current = savedSnapshot;
    if (!externalChanged) return;
    if (draftHasLocalChanges && !incomingMatchesDraft) return;

    setDraft(savedSnapshot);
  }, [draft, savedSnapshot]);

  const { flush } = useAutoSave({
    value: draft,
    savedValue: savedSnapshot,
    validate: () => validation.isValid,
    onSave: async (snapshot) => {
      await onSave({
        name: snapshot.name,
        start_date: snapshot.start_date || null,
        end_date: snapshot.end_date || null,
        reading_week_start: snapshot.reading_week_start || null,
        reading_week_end: snapshot.reading_week_end || null,
      });
    },
    onError: (error) => {
      console.error("Failed to save settings", error);
    },
  });

  const flushRef = useRef(flush);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    registerFlush?.(flush);
  }, [flush, registerFlush]);

  useEffect(() => {
    return () => {
      void flushRef.current();
    };
  }, []);

  return (
    <SettingsSection title="General" description="Update the name and key settings.">
      <FieldSet>
        <SemesterBasicsFields value={draft} onChange={(nextDraft) => setDraft(nextDraft)} />
      </FieldSet>
    </SettingsSection>
  );
};
