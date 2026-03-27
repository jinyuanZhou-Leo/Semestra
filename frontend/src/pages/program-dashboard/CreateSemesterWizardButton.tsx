// input:  [Program id, current Semester draft API, draft discard API, shadcn alert dialog primitives, router navigation, and button children]
// output: [`CreateSemesterWizardButton` entry component]
// pos:    [Program dashboard action that routes users into the standalone Create Semester wizard while handling draft resume or discard decisions]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

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
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/services/queryKeys";

import api from "../../services/api";

interface CreateSemesterWizardButtonProps extends Omit<React.ComponentProps<typeof Button>, "onClick"> {
  programId: string;
  onChanged?: () => Promise<void> | void;
  children: React.ReactNode;
}

export const CreateSemesterWizardButton: React.FC<CreateSemesterWizardButtonProps> = ({
  programId,
  onChanged,
  children,
  ...buttonProps
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const draftQuery = useQuery({
    queryKey: queryKeys.programs.semesterDraft(programId),
    queryFn: () => api.getCurrentSemesterDraft(programId),
    staleTime: 15_000,
  });

  const openWizard = () => {
    navigate(`/programs/${programId}/semesters/create`);
  };

  const handleClick = () => {
    if (draftQuery.data?.id) {
      setIsPromptOpen(true);
      return;
    }
    openWizard();
  };

  const handleDiscardAndRestart = async () => {
    if (!draftQuery.data?.id) {
      openWizard();
      return;
    }
    setIsDiscarding(true);
    try {
      await api.discardSemesterDraft(draftQuery.data.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.programs.semesterDraft(programId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.programs.detail(programId) }),
      ]);
      await onChanged?.();
      setIsPromptOpen(false);
      openWizard();
    } finally {
      setIsDiscarding(false);
    }
  };

  return (
    <>
      <Button {...buttonProps} onClick={handleClick}>
        {children}
      </Button>
      <AlertDialog open={isPromptOpen} onOpenChange={setIsPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume existing Semester draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This Program already has an in-progress Semester draft. You can continue where you left off or discard it and start over.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={openWizard}>Resume Draft</AlertDialogAction>
            <Button variant="outline" onClick={() => void handleDiscardAndRestart()} disabled={isDiscarding}>
              Discard and Restart
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
