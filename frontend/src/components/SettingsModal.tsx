import React from "react";
import { SettingsForm } from "./SettingsForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialName: string;
  initialSettings?: any; // e.g. credits, scaling table
  onSave: (data: any) => Promise<void>;
  type: "program" | "semester" | "course";
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  title,
  initialName,
  initialSettings = {},
  onSave,
  type,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0 sm:max-w-[520px]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <div className="p-6">
        <SettingsForm
          initialName={initialName}
          initialSettings={initialSettings}
          onSave={async (data) => {
            await onSave(data);
            onClose();
          }}
          type={type}
          showCancel
          onCancel={onClose}
        />
      </div>
      </DialogContent>
    </Dialog>
  );
};
