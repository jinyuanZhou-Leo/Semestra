import React from 'react';

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

import {
    EXTERNAL_COURSE_RESOURCE_CONFIRM_DESCRIPTION,
    EXTERNAL_COURSE_RESOURCE_CONFIRM_TITLE,
} from './shared';

export interface ExternalResourceOpenTarget {
    name: string;
    url: string;
}

interface ExternalResourceConfirmDialogProps {
    target: ExternalResourceOpenTarget | null;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}

export const ExternalResourceConfirmDialog: React.FC<ExternalResourceConfirmDialogProps> = ({
    target,
    onOpenChange,
    onConfirm,
}) => (
    <AlertDialog open={Boolean(target)} onOpenChange={onOpenChange}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{EXTERNAL_COURSE_RESOURCE_CONFIRM_TITLE}</AlertDialogTitle>
                <AlertDialogDescription className="flex flex-col gap-3">
                    <span>{EXTERNAL_COURSE_RESOURCE_CONFIRM_DESCRIPTION}</span>
                    {target ? (
                        <span className="flex flex-col gap-1">
                            <span className="font-medium text-foreground">{target.name}</span>
                            <span className="break-all rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                                {target.url}
                            </span>
                        </span>
                    ) : null}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onConfirm}>Open URL</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
);
