import React from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DataTable, DataTableActionMenu } from "../../components/DataTable";
import type { Course } from "../../services/api";
import { formatGpaPercentage } from "../../utils/percentage";

interface WizardCoursesStepProps {
  courseList: Course[];
  draftId: string | undefined;
  onOpenCourseManager: () => void;
  onRequestRemoveCourse: (course: Course) => void;
}

export const WizardCoursesStep: React.FC<WizardCoursesStepProps> = ({
  courseList,
  draftId,
  onOpenCourseManager,
  onRequestRemoveCourse,
}) => (
  <DataTable
    title="Semester Courses"
    description="Review the courses assigned to this Semester draft."
    showHeader={false}
    rootClassName="flex h-full min-h-0 flex-col"
    items={courseList}
    actionButton={(
      <Button
        type="button"
        onClick={onOpenCourseManager}
        disabled={!draftId}
        className="w-full shrink-0 sm:w-auto sm:self-start"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add / Manage Courses
      </Button>
    )}
    emptyMessage="No courses assigned."
    minWidthClassName="min-w-[34rem] sm:min-w-[42rem]"
    shellClassName="min-h-[18rem] min-w-0 flex-1 overflow-y-auto"
    emptyRowClassName="h-[15rem] align-middle sm:h-full"
    tableClassName="h-full w-full min-w-full sm:w-max sm:min-w-full [&_td]:max-w-[14rem] sm:[&_td]:max-w-[18rem] [&_td]:whitespace-normal sm:[&_td]:whitespace-nowrap [&_th]:max-w-[14rem] sm:[&_th]:max-w-[18rem] [&_th]:whitespace-normal sm:[&_th]:whitespace-nowrap"
    getRowKey={(course) => course.id}
    columns={[
      {
        key: 'name',
        label: 'Name',
        fit: 'fill',
        minWidth: 208,
        cellClassName: 'align-middle font-medium',
        cell: (course) => (
          <div className="flex flex-col gap-1">
            <span className="break-words">{course.name}</span>
            {course.alias ? (
              <span className="break-words text-xs text-muted-foreground">{course.alias}</span>
            ) : null}
          </div>
        ),
      },
      { key: 'credits', label: 'Credits', width: 104, cellClassName: 'align-middle whitespace-nowrap' },
      {
        key: 'grade',
        label: 'Grade',
        width: 112,
        cellClassName: 'align-middle whitespace-nowrap',
        cell: (course) => formatGpaPercentage(course.grade_percentage),
      },
      {
        key: 'actions',
        label: 'Actions',
        width: 56,
        align: 'right',
        cellClassName: 'align-middle',
        cell: (course) => (
          <DataTableActionMenu triggerLabel={`Open actions for ${course.name}`}>
            <DropdownMenuItem variant="destructive" onClick={() => onRequestRemoveCourse(course)}>
              <Trash2 className="h-4 w-4" />
              Remove
            </DropdownMenuItem>
          </DataTableActionMenu>
        ),
      },
    ]}
  />
);
