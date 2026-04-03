// input:  [semester id/name, delete callback, dialog alert helper, semester delete API, and shadcn alert/button primitives]
// output: [`DeleteSemesterButton` destructive-action control with confirmation dialog]
// pos:    [Program dashboard subcomponent that encapsulates semester deletion confirmation and async mutation state]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React, { useCallback, useState } from 'react';
import { Trash2 } from 'lucide-react';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import api from '@/services/api';

type ShowAlert = (options: { title: string; description: string }) => Promise<void>;

export type DeleteSemesterButtonProps = {
    semesterId: string;
    semesterName: string;
    onDeleted: () => Promise<void>;
    showAlert: ShowAlert;
};

export const DeleteSemesterButton: React.FC<DeleteSemesterButtonProps> = ({
    semesterId,
    semesterName,
    onDeleted,
    showAlert,
}) => {
    const [open, setOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const submitDeleteSemester = useCallback(async () => {
        setIsDeleting(true);
        try {
            await api.deleteSemester(semesterId);
            setOpen(false);
            await onDeleted();
        } catch (error) {
            console.error('Failed to delete semester', error);
            await showAlert({
                title: 'Delete failed',
                description: 'Failed to delete semester.',
            });
        } finally {
            setIsDeleting(false);
        }
    }, [onDeleted, semesterId, showAlert]);

    return (
        <>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isDeleting) {
                        setOpen(true);
                    }
                }}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
            <AlertDialog open={open} onOpenChange={(nextOpen) => !isDeleting && setOpen(nextOpen)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete semester?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {`Are you sure you want to delete ${semesterName || 'this semester'}? This action cannot be undone.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={submitDeleteSemester} disabled={isDeleting}>
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
