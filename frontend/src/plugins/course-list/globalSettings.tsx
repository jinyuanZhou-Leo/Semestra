import React, { useCallback, useEffect, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import api from '@/services/api';
import type { Course, Semester } from '@/services/api';
import type { WidgetGlobalSettingsProps } from '@/services/widgetRegistry';
import { Loader2, Trash2 } from 'lucide-react';

export const CourseListGlobalSettings: React.FC<WidgetGlobalSettingsProps> = ({ semesterId, onRefresh }) => {
  const [semester, setSemester] = useState<Semester | null>(null);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [removingCourseId, setRemovingCourseId] = useState<string | null>(null);

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
    if (removingCourseId) return;
    setRemovingCourseId(courseId);
    try {
      await api.updateCourse(courseId, { semester_id: null as any });
      void fetchSemester();
      onRefresh();
    } catch (error) {
      console.error('Failed to remove course', error);
    } finally {
      setRemovingCourseId(null);
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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Remove course ${course.name}`}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent size="sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove course from semester?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {course.name} will be removed from this semester but kept in the program.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={removingCourseId === course.id}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => void handleRemoveCourse(course.id)}
                              disabled={removingCourseId !== null}
                            >
                              {removingCourseId === course.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Removing...
                                </>
                              ) : (
                                'Remove'
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
