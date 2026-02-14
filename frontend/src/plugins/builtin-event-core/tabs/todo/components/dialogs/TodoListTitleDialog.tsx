"use no memo";

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TodoListTitleDialogProps {
  open: boolean;
  titleDraft: string;
  onOpenChange: (open: boolean) => void;
  onTitleDraftChange: (value: string) => void;
  onSave: () => void;
}

export const TodoListTitleDialog: React.FC<TodoListTitleDialogProps> = ({
  open,
  titleDraft,
  onOpenChange,
  onTitleDraftChange,
  onSave,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="select-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit List Title</DialogTitle>
          <DialogDescription>Update the list title.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="todo-list-title-edit">Title</Label>
          <Input
            id="todo-list-title-edit"
            value={titleDraft}
            onChange={(event) => onTitleDraftChange(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
