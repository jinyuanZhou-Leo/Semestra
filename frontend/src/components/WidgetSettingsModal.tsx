// input:  [active widget payload, widget registry settings component lookup, status-button feedback, save callback, dialog open state, and shadcn scroll area]
// output: [`WidgetSettingsModal` component]
// pos:    [Per-widget settings editor modal that preserves the last widget payload through close animation, keeps long settings forms scroll-safe, and commits changes on explicit save]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React, { useEffect, useState } from "react";
import type { WidgetItem } from "./widgets/DashboardGrid";
import type { WidgetUpdateData } from "../services/widgetRegistry";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusButton } from "./StatusButton";
import {
  getResolvedWidgetMetadataByType,
  getWidgetSettingsComponentByType,
} from "../plugin-system";

interface WidgetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  widget: WidgetItem | null;
  onSave: (id: string, data: WidgetUpdateData) => Promise<void>;
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
  const [renderedWidget, setRenderedWidget] = useState<WidgetItem | null>(widget);
  const activeWidget = widget ?? renderedWidget;
  const activeWidgetId = activeWidget?.id;
  const activeWidgetSettings = activeWidget?.settings;
  const widgetMetadata = getResolvedWidgetMetadataByType(activeWidget?.type || "");
  const displayWidgetName = widgetMetadata.name ?? activeWidget?.type ?? "Widget";
  const SettingsComponent = getWidgetSettingsComponentByType(activeWidget?.type || "");
  const [draftSettings, setDraftSettings] = useState<unknown>(widget?.settings || {});
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
            <Alert className="bg-background">
              <AlertTitle>Settings unavailable</AlertTitle>
              <AlertDescription>
                No settings are available for this widget type.
              </AlertDescription>
            </Alert>
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
            <div className="flex flex-col gap-4 px-6 py-5">
              <SettingsComponent
                widgetId={activeWidget?.id}
                semesterId={semesterId}
                courseId={courseId}
                settings={draftSettings}
                onSettingsChange={setDraftSettings}
              />
            </div>
          </ScrollArea>
          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-b-xl border-t bg-background px-6 pt-4 pb-6">
            <DialogClose asChild>
              <Button
                type="button"
                variant="secondary"
                disabled={saveState === "saving"}
              >
                Cancel
              </Button>
            </DialogClose>
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
