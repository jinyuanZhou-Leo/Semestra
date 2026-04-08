// input:  [semester initial fields, shared Semester basics fields, optional Program Home pin state, and debounced auto-save callback]
// output: [`SemesterSettingsPanel` component]
// pos:    [Semester settings form that reuses the shared shadcn Semester basics fields and now exposes Program Home pin management with unpin confirmation]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  getSemesterBasicsValidation,
  SemesterBasicsFields,
  type SemesterBasicsValue,
} from "@/components/SemesterBasicsFields";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { useAutoSave } from "@/hooks/useAutoSave";
import { Switch } from "@/components/ui/switch";

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
  initialPinnedToHomepage?: boolean;
  onTogglePinnedToHomepage?: (nextValue: boolean) => Promise<void>;
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
  initialPinnedToHomepage = false,
  onTogglePinnedToHomepage,
  registerFlush,
}) => {
  const [draft, setDraft] = useState<SemesterBasicsValue>(() => buildSemesterDraft(initialName, initialSettings));
  const [isPinnedToHomepage, setIsPinnedToHomepage] = useState(initialPinnedToHomepage);
  const [isConfirmingUnpin, setIsConfirmingUnpin] = useState(false);
  const savedSnapshot = useMemo(
    () => buildSemesterDraft(initialName, initialSettings),
    [initialName, initialSettings],
  );
  const lastLoadedSnapshotRef = useRef(savedSnapshot);
  const validation = useMemo(
    () => getSemesterBasicsValidation(draft),
    [draft],
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
    setIsPinnedToHomepage(initialPinnedToHomepage);
  }, [initialPinnedToHomepage]);

  useEffect(() => {
    return () => {
      void flushRef.current().catch(() => {});
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection title="General" description="Update the name and key settings.">
        <FieldSet>
          <SemesterBasicsFields value={draft} onChange={(nextDraft) => setDraft(nextDraft)} />
        </FieldSet>
      </SettingsSection>

      <SettingsSection title="Program Home" description="Control whether this Semester stays visible on Program Home.">
        <FieldSet>
          <FieldGroup>
            <Field orientation="responsive">
              <FieldContent>
                <FieldLabel htmlFor="semester-pin-homepage">Pin to Homepage</FieldLabel>
                <FieldDescription>Keep this Semester in the Program Home Focus Board.</FieldDescription>
              </FieldContent>
              <Switch
                id="semester-pin-homepage"
                checked={isPinnedToHomepage}
                onCheckedChange={(nextValue) => {
                  if (!onTogglePinnedToHomepage) {
                    setIsPinnedToHomepage(nextValue);
                    return;
                  }
                  if (nextValue) {
                    setIsPinnedToHomepage(true);
                    void onTogglePinnedToHomepage(true);
                    return;
                  }
                  setIsConfirmingUnpin(true);
                }}
                className="shrink-0"
              />
            </Field>
          </FieldGroup>
        </FieldSet>
      </SettingsSection>

      <AlertDialog open={isConfirmingUnpin} onOpenChange={setIsConfirmingUnpin}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this Semester from Program Home?</AlertDialogTitle>
            <AlertDialogDescription>
              This only removes the pin from Program Home. The Semester itself will stay unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setIsPinnedToHomepage(false);
                setIsConfirmingUnpin(false);
                void onTogglePinnedToHomepage?.(false);
              }}
            >
              Remove Pin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
