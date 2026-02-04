import React from "react";
import { Modal } from "./Modal";
import { WidgetRegistry } from "../services/widgetRegistry";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
      <Modal isOpen={isOpen} onClose={onClose} title="Widget Settings">
        <Alert>
          <AlertTitle>Settings unavailable</AlertTitle>
          <AlertDescription>
            No settings are available for this widget type.
          </AlertDescription>
        </Alert>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${widgetDefinition?.name} Settings`}
    >
      <SettingsComponent
        settings={widget?.settings || {}}
        onSave={handleSave}
        onClose={onClose}
      />
    </Modal>
  );
};
