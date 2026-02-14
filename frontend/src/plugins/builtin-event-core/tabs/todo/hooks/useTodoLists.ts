import React from 'react';
import type {
  SemesterCourseListState,
  SemesterCustomListStorage,
  TodoListModel,
  TodoListStorage,
  TodoTabMode,
} from '../types';

interface UseTodoListsParams {
  mode: TodoTabMode;
  courseId?: string;
  courseDisplayName: string;
  courseListStorage: TodoListStorage;
  semesterCourseLists: Record<string, SemesterCourseListState>;
  semesterCustomLists: SemesterCustomListStorage[];
}

export const useTodoLists = ({
  mode,
  courseId,
  courseDisplayName,
  courseListStorage,
  semesterCourseLists,
  semesterCustomLists,
}: UseTodoListsParams) => {
  const [selectedListId, setSelectedListId] = React.useState('');

  const courseModeList = React.useMemo<TodoListModel | null>(() => {
    if (!courseId) return null;

    return {
      id: `course:${courseId}`,
      name: courseDisplayName,
      source: 'course',
      editableName: false,
      courseId,
      sections: courseListStorage.sections,
      tasks: courseListStorage.tasks,
    };
  }, [courseDisplayName, courseId, courseListStorage]);

  const semesterCourseModels = React.useMemo<TodoListModel[]>(() => {
    return Object.values(semesterCourseLists)
      .sort((a, b) => a.courseName.localeCompare(b.courseName))
      .map((entry) => ({
        id: `course:${entry.courseId}`,
        name: entry.courseName,
        source: 'course',
        editableName: false,
        courseId: entry.courseId,
        sections: entry.sections,
        tasks: entry.tasks,
      }));
  }, [semesterCourseLists]);

  const semesterCustomModels = React.useMemo<TodoListModel[]>(() => {
    return semesterCustomLists.map((list) => ({
      id: list.id,
      name: list.name,
      source: 'semester-custom',
      editableName: true,
      sections: list.sections,
      tasks: list.tasks,
    }));
  }, [semesterCustomLists]);

  const allLists = React.useMemo<TodoListModel[]>(() => {
    if (mode === 'course') {
      return courseModeList ? [courseModeList] : [];
    }

    if (mode === 'semester') {
      return [...semesterCourseModels, ...semesterCustomModels];
    }

    return [];
  }, [mode, courseModeList, semesterCourseModels, semesterCustomModels]);

  React.useEffect(() => {
    if (allLists.length === 0) {
      if (selectedListId !== '') setSelectedListId('');
      return;
    }

    if (!allLists.some((list) => list.id === selectedListId)) {
      setSelectedListId(allLists[0].id);
    }
  }, [allLists, selectedListId]);

  const activeList = React.useMemo(() => {
    if (allLists.length === 0) return null;
    return allLists.find((list) => list.id === selectedListId) ?? allLists[0];
  }, [allLists, selectedListId]);

  return {
    selectedListId,
    setSelectedListId,
    allLists,
    activeList,
  };
};
