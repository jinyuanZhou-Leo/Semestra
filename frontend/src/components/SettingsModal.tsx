// input:  [open/close state props, title string, settings form children node]
// output: [`SettingsModal` component]
// pos:    [Generic modal container for compact settings editors]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void | Promise<void>;
  title: string;
  children: React.ReactNode;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const handleOpenChange = async (open: boolean) => {
    if (open) return;
    await onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { void handleOpenChange(open); }}>
      <DialogContent className="flex h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl lg:max-w-6xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Configure settings for {title}.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
};
