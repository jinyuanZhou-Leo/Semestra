// input:  [plugin settings props, semester/course API service, settings-section UI, and modal/alert primitives]
// output: [course-list plugin settings component for semester course management]
// pos:    [plugin-global settings panel that loads semester courses, surfaces failures, and handles removal flows]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to
"use no memo";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import type { PluginSettingsProps } from '@/services/pluginSettingsRegistry';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';

const resolveErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
};

export const CourseListGlobalSettings: React.FC<PluginSettingsProps> = ({ semesterId, onRefresh }) => {
  const [semester, setSemester] = useState<Semester | null>(null);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [removingCourseId, setRemovingCourseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const latestFetchRef = useRef(0);

  const fetchSemester = useCallback(async () => {
    if (!semesterId) {
      latestFetchRef.current += 1;
      setSemester(null);
      setLoadError(null);
      setIsLoading(false);
      return false;
    }

    const fetchId = latestFetchRef.current + 1;
    latestFetchRef.current = fetchId;
    setSemester((current) => (current?.id === semesterId ? current : null));
    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await api.getSemester(semesterId);
      if (fetchId !== latestFetchRef.current) return false;
      setSemester(data);
      return true;
    } catch (error) {
      if (fetchId !== latestFetchRef.current) return false;
      console.error('Failed to fetch semester', error);
      setLoadError(resolveErrorMessage(error, 'Unable to load courses for this semester.'));
      return false;
    } finally {
      if (fetchId === latestFetchRef.current) {
        setIsLoading(false);
      }
    }
  }, [semesterId]);

  useEffect(() => {
    void fetchSemester();
    return () => {
      latestFetchRef.current += 1;
    };
  }, [fetchSemester]);

  const handleRemoveCourse = async (courseId: string) => {
    if (removingCourseId) return;
    setRemovingCourseId(courseId);
    try {
      await api.updateCourse(courseId, { semester_id: null as any });
      const refreshed = await fetchSemester();
      onRefresh();
      if (!refreshed) {
        toast.error('Course was updated, but the course list could not be refreshed.');
      }
    } catch (error) {
      console.error('Failed to remove course', error);
      toast.error(resolveErrorMessage(error, 'Failed to remove course from this semester.'));
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
  const canManageCourses = programId.length > 0 && !isLoading && !loadError;

  return (
    <SettingsSection
      title="Courses"
      description="Manage courses assigned to this semester."
    >
      <div className="space-y-4">
        {loadError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Could not refresh semester courses</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{loadError}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void fetchSemester()}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="w-full">
          {isLoading && !semester ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground" role="status" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading courses...</span>
            </div>
          ) : courses.length === 0 ? (
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

        <Button
          type="button"
          onClick={() => setIsManagerOpen(true)}
          className="w-full"
          disabled={!canManageCourses}
        >
          + Add / Manage Courses
        </Button>

        {!canManageCourses ? (
          <p className="text-xs text-muted-foreground">
            Load semester details successfully before opening course management.
          </p>
        ) : null}

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
