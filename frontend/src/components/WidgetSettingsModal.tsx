// input:  [active widget payload, widget registry settings component lookup, save callback]
// output: [`WidgetSettingsModal` component]
// pos:    [Per-widget settings editor modal rendered from widget definition metadata]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useEffect, useState } from "react";
import { WidgetRegistry } from "../services/widgetRegistry";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SaveSettingButton } from "./SaveSettingButton";
import { getResolvedWidgetMetadataByType } from "../plugin-system";

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
  const widgetMetadata = getResolvedWidgetMetadataByType(widget?.type || "");
  const displayWidgetName = widgetDefinition?.name ?? widgetMetadata.name ?? widget?.type ?? "Widget";
  const SettingsComponent = widgetDefinition?.SettingsComponent;
  const [draftSettings, setDraftSettings] = useState<any>(widget?.settings || {});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success">("idle");

  useEffect(() => {
    setDraftSettings(widget?.settings || {});
    setSaveState("idle");
  }, [widget?.id, widget?.settings, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!widget || saveState === "saving") return;

    setSaveState("saving");
    try {
    await onSave(widget.id, {
      settings: JSON.stringify(draftSettings),
    });
      onClose();
    } catch (error) {
      console.error("Failed to save widget settings", error);
      setSaveState("idle");
    }
  };

  if (!SettingsComponent) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="p-0 sm:max-w-[520px]">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="text-base font-semibold">{displayWidgetName} Settings</DialogTitle>
            <DialogDescription className="sr-only">
              Configure settings for {displayWidgetName}.
            </DialogDescription>
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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && saveState !== "saving") onClose();
      }}
    >
      <DialogContent className="p-0 sm:max-w-[520px]">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-base font-semibold">
            {displayWidgetName} Settings
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure settings for {displayWidgetName}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="p-6">
          <div className="space-y-4">
            <SettingsComponent
              settings={draftSettings}
              onSettingsChange={setDraftSettings}
            />
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saveState === "saving"}
            >
              Cancel
            </Button>
            <SaveSettingButton
              type="submit"
              label="Save Settings"
              saveState={saveState}
              animated={false}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
