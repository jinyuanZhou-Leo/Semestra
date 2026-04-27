import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

    expect(screen.getByText('No widgets available')).toBeInTheDocument();
    expect(screen.getByText('This dashboard does not have any widgets available to add right now.')).toBeInTheDocument();
    expect(screen.queryByText('Counter')).not.toBeInTheDocument();
    expect(screen.queryByText('World Clock')).not.toBeInTheDocument();
  });

  it('keeps the modal open when adding a widget returns false', async () => {
    const onAdd = vi.fn().mockResolvedValue(false);
    const onClose = vi.fn();

    render(
      <AddWidgetModal
        isOpen
        onClose={onClose}
        onAdd={onAdd}
        context="semester"
        widgets={[]}
      />,
    );

    fireEvent.click(screen.getByText('Counter'));
    fireEvent.click(screen.getByRole('button', { name: 'Add Widget' }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith('counter');
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Counter')).toBeInTheDocument();
  });
});
