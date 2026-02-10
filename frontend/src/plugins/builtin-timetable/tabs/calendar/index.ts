import React from 'react';
import type { TabProps } from '@/services/tabRegistry';
import { CalendarSkeleton } from './components/CalendarSkeleton';

const LazyCalendarTab = React.lazy(async () => {
  const module = await import('./CalendarTab');
  return { default: module.CalendarTab };
});

export const CalendarTab: React.FC<TabProps> = (props) => {
  return React.createElement(
    React.Suspense,
    { fallback: React.createElement(CalendarSkeleton) },
    React.createElement(LazyCalendarTab, props),
  );
};

export { CalendarSkeleton } from './components/CalendarSkeleton';
export { CalendarSettingsSection } from './CalendarSettingsSection';
