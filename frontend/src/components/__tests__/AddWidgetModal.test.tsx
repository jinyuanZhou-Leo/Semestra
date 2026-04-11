import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AddWidgetModal } from '../AddWidgetModal';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('../../plugin-system', () => ({
  canAddWidgetCatalogItem: vi.fn(() => true),
  getResolvedWidgetMetadataByType: vi.fn((type: string) => ({
    name: type === 'counter' ? 'Counter' : 'World Clock',
    description: type === 'counter' ? 'Count things.' : 'Show world times.',
    icon: null,
  })),
  getWidgetCatalog: vi.fn(() => [
    {
      pluginId: 'counter-plugin',
      type: 'counter',
      name: 'Counter',
      description: 'Count things.',
      icon: null,
      allowedContexts: ['semester', 'course'],
    },
    {
      pluginId: 'world-clock-plugin',
      type: 'world-clock',
      name: 'World Clock',
      description: 'Show world times.',
      icon: null,
      allowedContexts: ['semester', 'course'],
    },
  ]),
}));

describe('AddWidgetModal', () => {
  it('treats an empty allowed widget list as no available widgets', () => {
    render(
      <AddWidgetModal
        isOpen
        onClose={vi.fn()}
        onAdd={vi.fn()}
        context="semester"
        widgets={[]}
        allowedTypes={[]}
      />,
    );

    expect(screen.getByText('No widgets available for this dashboard.')).toBeInTheDocument();
    expect(screen.queryByText('Counter')).not.toBeInTheDocument();
    expect(screen.queryByText('World Clock')).not.toBeInTheDocument();
  });
});
