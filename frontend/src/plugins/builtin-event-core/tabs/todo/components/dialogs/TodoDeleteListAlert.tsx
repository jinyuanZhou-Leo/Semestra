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

interface TodoDeleteListAlertProps {
  open: boolean;
  listName: string;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void;
}

export const TodoDeleteListAlert: React.FC<TodoDeleteListAlertProps> = ({
  open,
  listName,
  onOpenChange,
  onConfirmDelete,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm" className="select-none">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete list?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. List{' '}
            <span className="font-medium text-foreground">{listName}</span>{' '}
            and its tasks will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirmDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
