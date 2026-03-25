// input:  [`SemesterSettingsPanel`, testing-library render helpers, and Vitest matchers]
// output: [regression tests covering shadcn invalid-state wiring for valid and invalid semester date selections]
// pos:    [Component regression suite that ensures semester date buttons only expose invalid styling attributes when validation actually fails]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SemesterSettingsPanel } from '@/components/SemesterSettingsPanel';

const createMatchMedia = () => ({
  matches: false,
  media: '',
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(createMatchMedia),
});

describe('SemesterSettingsPanel', () => {
  it('does not expose shadcn invalid attributes for valid semester ranges', () => {
    render(
      <SemesterSettingsPanel
        initialName="26W"
        initialSettings={{
          start_date: '2026-01-15',
          end_date: '2026-04-07',
          reading_week_start: '2026-02-16',
          reading_week_end: '2026-02-22',
        }}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const durationField = screen.getByText('Semester Duration').closest('[data-slot="field"]');
    const readingWeekField = screen.getByText('Reading Week').closest('[data-slot="field"]');
    const durationButton = durationField?.querySelector('button');
    const readingWeekButton = readingWeekField?.querySelector('button');

    expect(durationField).not.toHaveAttribute('data-invalid');
    expect(readingWeekField).not.toHaveAttribute('data-invalid');
    expect(durationButton).not.toHaveAttribute('aria-invalid');
    expect(readingWeekButton).not.toHaveAttribute('aria-invalid');
    expect(durationButton).toHaveTextContent('Jan 15, 2026 - Apr 7, 2026');
    expect(readingWeekButton).toHaveTextContent('Feb 16, 2026 - Feb 22, 2026');
  });

  it('only exposes invalid attributes when reading week validation actually fails', () => {
    render(
      <SemesterSettingsPanel
        initialName="26W"
        initialSettings={{
          start_date: '2026-01-15',
          end_date: '2026-04-07',
          reading_week_start: '2026-02-16',
          reading_week_end: '2026-02-20',
        }}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const readingWeekField = screen.getByText('Reading Week').closest('[data-slot="field"]');
    const readingWeekButton = readingWeekField?.querySelector('button');

    expect(readingWeekField).toHaveAttribute('data-invalid', 'true');
    expect(readingWeekButton).toHaveAttribute('aria-invalid', 'true');
    expect(readingWeekButton).toHaveTextContent('Feb 16, 2026 - Feb 20, 2026');
    expect(screen.getByText('Reading Week must span exactly one Monday-to-Sunday week.')).toBeInTheDocument();
  });
});
