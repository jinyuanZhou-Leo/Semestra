// input:  [plugin setup contract helpers, shared setup-form primitives, settings-style table/dialog primitives, and builtin event-type dialog]
// output: [default-exported builtin-event-core plugin setup definition with host-aligned custom setup/review UI]
// pos:    [Semester setup entry for builtin-event-core that keeps calendar default-view onboarding in the host contract while rendering event-core-specific controls inside the shared setup form shells]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from "react";
import { Edit, Plus, Trash2 } from "lucide-react";

import { DataTable, DataTableActionMenu } from "@/components/DataTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  PluginSetupFormField,
  PluginSetupFormReviewItem,
  PluginSetupFormSection,
  PluginSetupFormSurface,
} from "@/components/PluginSetupForm";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import {
  definePluginSetup,
  PluginSetupJsonField,
  PluginSetupSection,
  PluginSetupSelectField,
  type PluginSetupReviewRenderProps,
  type PluginSetupValidationIssue,
  type PluginSetupWizardRenderProps,
} from "@/plugin-sdk";

import { EventTypeFormDialog, type CourseEventType } from "./components/EventTypeFormDialog";

type EventTypeSetupItem = CourseEventType;

type EventTypeDialogError = {
  field: "code" | "abbreviation";
  message: string;
};

const CALENDAR_VIEW_OPTIONS = [
  { label: "Month", value: "month" },
  { label: "Week", value: "week" },
] as const;

const DEFAULT_EVENT_TYPES: EventTypeSetupItem[] = [
  { id: "builtin-lecture", code: "LECTURE", abbreviation: "LEC", track_attendance: false, color: null, icon: null },
  { id: "builtin-practical", code: "PRACTICAL", abbreviation: "PRA", track_attendance: false, color: null, icon: null },
  { id: "builtin-tutorial", code: "TUTORIAL", abbreviation: "TUT", track_attendance: false, color: null, icon: null },
];

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const createEventTypeId = () => (
  `event-type-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
);

const normalizeEventTypeItems = (value: unknown): EventTypeSetupItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (!isRecord(item)) {
      return [];
    }

    const rawCode = typeof item.code === "string" ? item.code.trim().toUpperCase() : "";
    const rawAbbreviation = typeof item.abbreviation === "string" ? item.abbreviation.trim().toUpperCase() : "";
    if (!rawCode || !rawAbbreviation) {
      return [];
    }

    return [{
      id: typeof item.id === "string" && item.id.trim() ? item.id : `${rawCode}-${index}`,
      code: rawCode,
      abbreviation: rawAbbreviation,
      track_attendance: Boolean(item.track_attendance),
      color: typeof item.color === "string" ? item.color : null,
      icon: typeof item.icon === "string" ? item.icon : null,
    }];
  });
};

const validateEventTypeItems = (value: unknown): PluginSetupValidationIssue[] => {
  const issues: PluginSetupValidationIssue[] = [];

  if (!Array.isArray(value) || value.length === 0) {
    return [{
      fieldPath: "eventTypes",
      message: "Add at least one event type before continuing.",
    }];
  }

  const seenCodes = new Set<string>();
  const seenAbbreviations = new Set<string>();

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push({
        fieldPath: "eventTypes",
        message: `Event type row ${index + 1} is invalid.`,
      });
      return;
    }

    const code = typeof item.code === "string" ? item.code.trim().toUpperCase() : "";
    const abbreviation = typeof item.abbreviation === "string" ? item.abbreviation.trim().toUpperCase() : "";

    if (!code) {
      issues.push({
        fieldPath: "eventTypes",
        message: `Event type row ${index + 1} must include a type name.`,
      });
    } else if (seenCodes.has(code)) {
      issues.push({
        fieldPath: "eventTypes",
        message: `Event type "${code}" is duplicated.`,
      });
    } else {
      seenCodes.add(code);
    }

    if (!abbreviation) {
      issues.push({
        fieldPath: "eventTypes",
        message: `Event type row ${index + 1} must include an abbreviation.`,
      });
    } else if (seenAbbreviations.has(abbreviation)) {
      issues.push({
        fieldPath: "eventTypes",
        message: `Event type abbreviation "${abbreviation}" is duplicated.`,
      });
    } else {
      seenAbbreviations.add(abbreviation);
    }
  });

  return issues;
};

const parseEventTypeDialogError = (error: unknown): EventTypeDialogError[] | null => {
  if (!isRecord(error)) {
    return null;
  }

  const field = error.field;
  const message = error.message;
  if ((field === "code" || field === "abbreviation") && typeof message === "string") {
    return [{ field, message }];
  }

  return null;
};

const EventTypeSetupTable: React.FC<{
  items: EventTypeSetupItem[];
  readOnly?: boolean;
  onChange?: (items: EventTypeSetupItem[]) => void;
}> = ({
  items,
  readOnly = false,
  onChange,
}) => {
  const [editingType, setEditingType] = React.useState<EventTypeSetupItem | null>(null);
  const [pendingDeleteType, setPendingDeleteType] = React.useState<EventTypeSetupItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const handleOpenCreate = React.useCallback(() => {
    setEditingType(null);
    setIsDialogOpen(true);
  }, []);

  const handleSave = React.useCallback(async (nextItem: {
    code: string;
    abbreviation: string;
    track_attendance: boolean;
  }) => {
    if (!onChange) {
      return;
    }

    const nextCode = nextItem.code.trim().toUpperCase();
    const nextAbbreviation = nextItem.abbreviation.trim().toUpperCase();
    const rowsExcludingEdited = items.filter((item) => item.id !== editingType?.id);

    if (rowsExcludingEdited.some((item) => item.code.trim().toUpperCase() === nextCode)) {
      throw {
        field: "code",
        message: "This type name already exists in the setup table.",
      };
    }
    if (rowsExcludingEdited.some((item) => item.abbreviation.trim().toUpperCase() === nextAbbreviation)) {
      throw {
        field: "abbreviation",
        message: "This abbreviation already exists in the setup table.",
      };
    }

    const nextRow: EventTypeSetupItem = {
      id: editingType?.id ?? createEventTypeId(),
      code: nextCode,
      abbreviation: nextAbbreviation,
      track_attendance: nextItem.track_attendance,
      color: editingType?.color ?? null,
      icon: editingType?.icon ?? null,
    };

    onChange(
      editingType
        ? items.map((item) => (item.id === editingType.id ? nextRow : item))
        : [...items, nextRow],
    );
    setEditingType(null);
  }, [editingType, items, onChange]);

  const handleDelete = React.useCallback(() => {
    if (!onChange || !pendingDeleteType) {
      return;
    }

    onChange(items.filter((item) => item.id !== pendingDeleteType.id));
    setPendingDeleteType(null);
  }, [items, onChange, pendingDeleteType]);

  return (
    <>
      <DataTable
        title="Event Types"
        description="Configure the event types that courses should start from when this Semester uses Academic Events."
        showHeader={false}
        items={items}
        emptyMessage="No event types configured yet."
        minWidthClassName="min-w-[34rem] sm:min-w-[38rem]"
        actionButton={readOnly ? undefined : (
          <Button type="button" onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Type
          </Button>
        )}
        renderHeader={() => (
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Abbr</TableHead>
            <TableHead>Track Attendance</TableHead>
            {!readOnly ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        )}
        renderRow={(item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.code}</TableCell>
            <TableCell>{item.abbreviation}</TableCell>
            <TableCell>
              <Badge variant={item.track_attendance ? "default" : "secondary"}>
                {item.track_attendance ? "Yes" : "No"}
              </Badge>
            </TableCell>
            {!readOnly ? (
              <TableCell className="text-right">
                <div className="flex justify-end">
                  <DataTableActionMenu triggerLabel={`Open actions for ${item.code}`}>
                    <DropdownMenuItem onClick={() => {
                      setEditingType(item);
                      setIsDialogOpen(true);
                    }}
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setPendingDeleteType(item)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DataTableActionMenu>
                </div>
              </TableCell>
            ) : null}
          </TableRow>
        )}
      />

      {!readOnly ? (
        <>
          <EventTypeFormDialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingType(null);
              }
            }}
            title={editingType ? "Edit Event Type" : "Create Event Type"}
            description={editingType
              ? "Update the event type definition for this Semester setup."
              : "Define a new event type that the Semester should start with."}
            initialData={editingType}
            onSubmit={handleSave}
            parseError={parseEventTypeDialogError}
          />
          <AlertDialog open={pendingDeleteType !== null} onOpenChange={(open) => !open && setPendingDeleteType(null)}>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {pendingDeleteType ? `Delete event type ${pendingDeleteType.code}?` : "Delete event type?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This only removes the event type from the Semester setup draft.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </>
  );
};

const BuiltinEventCoreSetupView: React.FC<PluginSetupWizardRenderProps> = ({
  values,
  generalErrors,
  getFieldError,
  onValueChange,
}) => {
  const eventTypes = React.useMemo(
    () => normalizeEventTypeItems(values.eventTypes ?? DEFAULT_EVENT_TYPES),
    [values.eventTypes],
  );

  return (
    <PluginSetupFormSurface generalErrors={generalErrors}>
      <PluginSetupFormSection
        title="Calendar Setup"
        description="Choose how the Calendar tab should open the first time students land in this Semester."
      >
        <PluginSetupFormField
          label="Calendar Default View"
          htmlFor="builtin-event-core-calendar-default-view"
          error={getFieldError("calendarDefaultView")}
        >
          <Select
            value={typeof values.calendarDefaultView === "string" ? values.calendarDefaultView : "month"}
            onValueChange={(nextValue) => onValueChange("calendarDefaultView", nextValue)}
          >
            <SelectTrigger id="builtin-event-core-calendar-default-view" aria-invalid={Boolean(getFieldError("calendarDefaultView"))}>
              <SelectValue placeholder="Select the initial view" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {CALENDAR_VIEW_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </PluginSetupFormField>
      </PluginSetupFormSection>

      <PluginSetupFormSection
        title="Event Types"
        description="Start the Semester with the event types you expect courses to use most often."
        separated
      >
        <PluginSetupFormField
          description="Manage the event-type catalog that Academic Events should start from."
          error={getFieldError("eventTypes")}
        >
          <EventTypeSetupTable
            items={eventTypes}
            onChange={(nextItems) => onValueChange("eventTypes", nextItems)}
          />
        </PluginSetupFormField>
      </PluginSetupFormSection>
    </PluginSetupFormSurface>
  );
};

const BuiltinEventCoreReviewView: React.FC<PluginSetupReviewRenderProps> = ({ values }) => {
  const calendarDefaultView = typeof values.calendarDefaultView === "string" ? values.calendarDefaultView : "month";
  const eventTypes = normalizeEventTypeItems(values.eventTypes ?? DEFAULT_EVENT_TYPES);

  return (
    <PluginSetupFormSurface>
      <PluginSetupFormSection
        title="Calendar Setup"
        description="This is the initial Calendar surface students will see for the Semester."
      >
        <PluginSetupFormReviewItem
          label="Calendar Default View"
          value={CALENDAR_VIEW_OPTIONS.find((option) => option.value === calendarDefaultView)?.label ?? calendarDefaultView}
        />
      </PluginSetupFormSection>

      <PluginSetupFormSection
        title="Event Types"
        description="These event types will seed Academic Events in the Semester."
        separated
      >
        <PluginSetupFormField description="Review the event-type catalog that will seed Academic Events.">
          <EventTypeSetupTable items={eventTypes} readOnly />
        </PluginSetupFormField>
      </PluginSetupFormSection>
    </PluginSetupFormSurface>
  );
};

export default definePluginSetup({
  content: (
    <>
      <PluginSetupSection
        id="calendar-default-view"
        title="Calendar Setup"
        description="Choose the default Calendar view for this Semester."
      >
        <PluginSetupSelectField
          path="calendarDefaultView"
          settingsKey="builtin-event-core"
          label="Calendar default view"
          required
          defaultValue="month"
          description="Choose the initial Calendar view for this Semester."
          options={CALENDAR_VIEW_OPTIONS.map((option) => ({ ...option }))}
          summaryLabels={{
            month: "Month",
            week: "Week",
          }}
        />
      </PluginSetupSection>

      <PluginSetupSection
        id="event-type-setup"
        title="Event Types"
        description="Configure the default event-type catalog for course scheduling."
      >
        <PluginSetupJsonField
          path="eventTypes"
          settingsKey="builtin-event-core"
          label="Default event types"
          description="Configure the event types that this Semester should start with."
        />
      </PluginSetupSection>
    </>
  ),
  ui: {
    setupComponent: BuiltinEventCoreSetupView,
    reviewComponent: BuiltinEventCoreReviewView,
  },
  validate: ({ values }) => validateEventTypeItems(values.eventTypes ?? DEFAULT_EVENT_TYPES),
});
