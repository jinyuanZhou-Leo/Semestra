// input:  [event type list data, CRUD callbacks, shared data-table UI, and EventTypeFormDialog]
// output: [`EventTypesDataTable` pure-UI component for rendering and editing a list of course event types]
// pos:    [shared table component consumed by both CourseScheduleSettings (course path) and SemesterEventTypesSettingsSection (semester path via plugin settings bucket)]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to


import React from 'react';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DataTable, DataTableActionMenu } from '@/components/DataTable';
import type { CourseEventType } from '@/services/schedule';
import { EventTypeFormDialog } from '../../components/EventTypeFormDialog';

export interface EventTypeFormData {
  code: string;
  abbreviation: string;
  track_attendance: boolean;
}

interface EventTypesDataTableProps {
  eventTypes: CourseEventType[];
  isLoading: boolean;
  onCreateOrUpdate: (data: EventTypeFormData, editingType: CourseEventType | null) => Promise<void>;
  onDelete: (code: string) => Promise<void>;
}

export const EventTypesDataTable: React.FC<EventTypesDataTableProps> = ({
  eventTypes,
  isLoading,
  onCreateOrUpdate,
  onDelete,
}) => {
  const [editingType, setEditingType] = React.useState<CourseEventType | null>(null);
  const [pendingDeleteType, setPendingDeleteType] = React.useState<CourseEventType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (!editingType) return;
    setIsDialogOpen(true);
  }, [editingType]);

  const handleOpenCreate = React.useCallback(() => {
    setEditingType(null);
    setIsDialogOpen(true);
  }, []);

  const handleSubmit = React.useCallback(async (data: EventTypeFormData) => {
    await onCreateOrUpdate(data, editingType);
    setEditingType(null);
  }, [editingType, onCreateOrUpdate]);

  return (
    <>
      <DataTable
        title="Event Types"
        description="Manage the event types available for course schedules (e.g., Lecture, Tutorial, Lab)."
        items={eventTypes}
        isLoading={isLoading}
        minWidthClassName="min-w-[34rem] sm:min-w-[38rem]"
        actionButton={(
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Type
          </Button>
        )}
        getRowKey={(item) => item.id}
        columns={[
          { key: 'code',         label: 'Type',             fit: 'fill', cellClassName: 'font-medium' },
          { key: 'abbreviation', label: 'Abbr',             width: 80 },
          {
            key: 'track_attendance',
            label: 'Track Attendance',
            width: 168,
            cell: (item) => (
              <Badge variant={item.track_attendance ? 'default' : 'secondary'}>
                {item.track_attendance ? 'Yes' : 'No'}
              </Badge>
            ),
          },
          {
            key: 'actions',
            label: 'Actions',
            width: 72,
            align: 'right',
            cell: (item) => (
              <DataTableActionMenu triggerLabel={`Open actions for ${item.code}`}>
                <DropdownMenuItem onClick={() => setEditingType(item)}>
                  <Edit className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setPendingDeleteType(item)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DataTableActionMenu>
            ),
          },
        ]}
      />

      <AlertDialog open={pendingDeleteType !== null} onOpenChange={(open) => !open && setPendingDeleteType(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDeleteType ? `Delete event type ${pendingDeleteType.code}?` : 'Delete event type?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone and may affect sections using this event type.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!pendingDeleteType) return;
                void onDelete(pendingDeleteType.code);
                setPendingDeleteType(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EventTypeFormDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingType(null);
        }}
        initialData={editingType}
        onSubmit={handleSubmit}
      />
    </>
  );
};
