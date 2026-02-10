import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0 sm:max-w-[520px]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Configure settings for {title}.
          </DialogDescription>
        </DialogHeader>
        <div className="p-6">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
};
