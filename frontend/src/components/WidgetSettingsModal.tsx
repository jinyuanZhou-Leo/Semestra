// input:  [active widget payload, widget registry settings component lookup, status-button feedback, save callback, dialog open state, and shadcn scroll area]
// output: [`WidgetSettingsModal` component]
// pos:    [Per-widget settings editor modal that preserves the last widget payload through close animation, keeps long settings forms scroll-safe, and commits changes on explicit save]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

"use no memo";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusButton } from "./StatusButton";
import {
  getResolvedWidgetMetadataByType,
  getWidgetSettingsComponentByType,
} from "../plugin-system";

interface WidgetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  widget: any;
  onSave: (id: string, data: any) => Promise<void>;
  semesterId?: string;
  courseId?: string;
}

export const WidgetSettingsModal: React.FC<WidgetSettingsModalProps> = ({
  isOpen,
  onClose,
  widget,
  onSave,
  semesterId,
  courseId,
}) => {
  const [renderedWidget, setRenderedWidget] = useState(widget);
  const activeWidget = widget ?? renderedWidget;
  const activeWidgetId = activeWidget?.id;
  const activeWidgetSettings = activeWidget?.settings;
  const widgetMetadata = getResolvedWidgetMetadataByType(activeWidget?.type || "");
  const displayWidgetName = widgetMetadata.name ?? activeWidget?.type ?? "Widget";
  const SettingsComponent = getWidgetSettingsComponentByType(activeWidget?.type || "");
  const [draftSettings, setDraftSettings] = useState<any>(widget?.settings || {});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success">("idle");

  useEffect(() => {
    if (widget) {
      setRenderedWidget(widget);
    }
  }, [widget]);

  useEffect(() => {
    if (!isOpen || !activeWidgetId) return;

    setDraftSettings(activeWidgetSettings || {});
    setSaveState("idle");
  }, [activeWidgetId, activeWidgetSettings, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWidget || saveState === "saving") return;

    setSaveState("saving");
    try {
      await onSave(activeWidget.id, {
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
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
          <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
            <DialogTitle className="text-base font-semibold">{displayWidgetName} Settings</DialogTitle>
            <DialogDescription className="sr-only">
              Configure settings for {displayWidgetName}.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5">
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
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
          <DialogTitle className="text-base font-semibold">
            {displayWidgetName} Settings
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure settings for {displayWidgetName}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 px-6 py-5">
              <SettingsComponent
                widgetId={activeWidget?.id}
                semesterId={semesterId}
                courseId={courseId}
                settings={draftSettings}
                onSettingsChange={setDraftSettings}
              />
            </div>
          </ScrollArea>
          <DialogFooter className="shrink-0 border-t px-6 pt-4 pb-6">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saveState === "saving"}
            >
              Cancel
            </Button>
            <StatusButton
              type="submit"
              label="Save Settings"
              status={saveState}
              animated={false}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
