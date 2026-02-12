import React, { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { SettingsSection } from '@/components/SettingsSection';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CourseManagerModal } from '@/components/CourseManagerModal';
import { useDialog } from '@/contexts/DialogContext';
import api from '@/services/api';
import type { Course, Semester } from '@/services/api';
import type { WidgetGlobalSettingsProps } from '@/services/widgetRegistry';

export const CourseListGlobalSettings: React.FC<WidgetGlobalSettingsProps> = ({ semesterId, onRefresh }) => {
  const [semester, setSemester] = useState<Semester | null>(null);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const { confirm } = useDialog();

  const fetchSemester = useCallback(async () => {
    if (!semesterId) return;
    try {
      const data = await api.getSemester(semesterId);
      setSemester(data);
    } catch (error) {
      console.error('Failed to fetch semester', error);
    }
  }, [semesterId]);

  useEffect(() => {
    void fetchSemester();
  }, [fetchSemester]);

  const handleRemoveCourse = async (courseId: string) => {
    const shouldRemove = await confirm({
      title: 'Remove course?',
      description: 'Are you sure you want to remove this course from the semester? It will remain in the program.',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      tone: 'destructive',
    });
    if (!shouldRemove) return;
    try {
      await api.updateCourse(courseId, { semester_id: null as any });
      void fetchSemester();
      onRefresh();
    } catch (error) {
      console.error('Failed to remove course', error);
    }
  };

  const handleCourseAdded = () => {
    void fetchSemester();
    onRefresh();
  };

  if (!semesterId) {
    return <div className="text-muted-foreground">Semester context required.</div>;
  }

  const courses = semester?.courses || [];
  const programId = semester?.program_id || '';

  return (
    <SettingsSection
      title="Courses"
      description="Manage courses assigned to this semester."
    >
      <div className="space-y-4">
        <div className="rounded-md border bg-card">
          {courses.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No courses assigned.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course: Course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{course.name}</span>
                        <div className="mt-0.5 flex items-center gap-2">
                          {course.alias && (
                            <span className="text-xs text-muted-foreground">
                              {course.alias}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{course.credits}</TableCell>
                    <TableCell>{course.grade_percentage}%</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleRemoveCourse(course.id)}
                        className="h-8 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <Button onClick={() => setIsManagerOpen(true)} className="w-full">
          + Add / Manage Courses
        </Button>

        <CourseManagerModal
          isOpen={isManagerOpen}
          onClose={() => setIsManagerOpen(false)}
          programId={programId}
          semesterId={semesterId}
          onCourseAdded={handleCourseAdded}
        />
      </div>
    </SettingsSection>
  );
};

