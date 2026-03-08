// input:  [React lazy loading helpers, calendar shell components, and builtin source registration]
// output: [lazy Calendar tab entrypoint plus Calendar settings exports]
// pos:    [calendar module entry that keeps builtin sources registered before runtime and settings surfaces mount]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import type { TabProps } from '@/services/tabRegistry';
import { CalendarSkeleton } from './components/CalendarSkeleton';
import { ensureBuiltinCalendarSourcesRegistered } from './sources/registerBuiltinCalendarSources';

ensureBuiltinCalendarSourcesRegistered();

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
