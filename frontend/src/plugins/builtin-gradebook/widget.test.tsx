// input:  [Vitest + Testing Library, builtin-gradebook widget runtime, and mocked course responses]
// output: [test suite validating the CSS-responsive course-metrics widget rendering and context guard behavior]
// pos:    [plugin-level regression tests for the builtin-gradebook course KPI widget]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api, { type Course } from '@/services/api';
import { BuiltinGradebookSummaryWidgetDefinition } from './widget';

const courseResponse: Course = {
    id: 'course-1',
    name: 'Advanced Writing',
    credits: 3,
    grade_scaled: 3.7,
    grade_percentage: 88,
    program_id: 'program-1',
};

describe('BuiltinGradebookSummaryWidget', () => {
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: originalMatchMedia,
        });
    });

    it('loads and renders the compact course metrics', async () => {
        vi.spyOn(api, 'getCourse').mockResolvedValue(courseResponse);

        const WidgetComponent = BuiltinGradebookSummaryWidgetDefinition.component;
        render(
            <WidgetComponent
                widgetId="gradebook-summary-1"
                courseId="course-1"
                settings={{}}
                updateSettings={vi.fn()}
            />,
        );

        expect(await screen.findByText('Credits')).toBeInTheDocument();
        expect(screen.getAllByText('3.00').length).toBeGreaterThan(0);
        expect(screen.getByText('GPA')).toBeInTheDocument();
        expect(screen.getAllByText('3.70').length).toBeGreaterThan(0);
        expect(screen.getByText('GPA Percentage')).toBeInTheDocument();
        expect(screen.getAllByText('88.0%').length).toBeGreaterThan(0);
    });

    it('shows the course-context guard when no course id is available', async () => {
        const WidgetComponent = BuiltinGradebookSummaryWidgetDefinition.component;
        render(
            <WidgetComponent
                widgetId="gradebook-summary-2"
                settings={{}}
                updateSettings={vi.fn()}
            />,
        );

        expect(await screen.findByText('Gradebook unavailable')).toBeInTheDocument();
        expect(screen.getByText('This widget requires a course context.')).toBeInTheDocument();
    });
});
