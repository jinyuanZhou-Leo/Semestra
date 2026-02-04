import React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  contentPadding?: string;
  width?: string | number;
  maxWidth?: string | number;
  height?: string | number;
  minHeight?: string | number;
  maxHeight?: string | number;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  contentPadding,
  width = "90%",
  maxWidth = "500px",
  height,
  minHeight = 300,
  maxHeight = "90vh",
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn("p-0")}
        style={{
          width,
          maxWidth,
          height,
          minHeight,
          maxHeight,
          overflowY: "auto",
        }}
      >
        {title && (
          <div className="flex items-center justify-between border-b px-6 py-4">
            <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
            <button
              type="button"
              onClick={onClose}
              className="text-xl leading-none text-muted-foreground transition hover:text-foreground"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        )}
        <div style={{ padding: contentPadding ?? "1.5rem" }}>{children}</div>
      </DialogContent>
    </Dialog>
  );
};
