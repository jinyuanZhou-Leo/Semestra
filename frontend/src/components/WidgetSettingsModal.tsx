import React from "react";
import { WidgetRegistry } from "../services/widgetRegistry";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface WidgetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  widget: any;
  onSave: (id: string, data: any) => Promise<void>;
}

export const WidgetSettingsModal: React.FC<WidgetSettingsModalProps> = ({
  isOpen,
  onClose,
  widget,
  onSave,
}) => {
  const widgetDefinition = WidgetRegistry.get(widget?.type);
  const SettingsComponent = widgetDefinition?.SettingsComponent;

  const handleSave = async (newSettings: any) => {
    await onSave(widget.id, {
      settings: JSON.stringify(newSettings),
    });
    onClose();
  };

  if (!SettingsComponent) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="p-0 sm:max-w-[520px]">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="text-base font-semibold">Widget Settings</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <div
              className="relative w-full rounded-lg border bg-background p-4 text-foreground [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7"
              role="alert"
            >
              <div className="mb-1 font-medium leading-none tracking-tight">
                Settings unavailable
              </div>
              <div className="text-sm text-muted-foreground">
                No settings are available for this widget type.
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0 sm:max-w-[520px]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-base font-semibold">
            {widgetDefinition?.name} Settings
          </DialogTitle>
        </DialogHeader>
        <div className="p-6">
          <SettingsComponent
            settings={widget?.settings || {}}
            onSave={handleSave}
            onClose={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
