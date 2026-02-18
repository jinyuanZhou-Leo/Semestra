import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StickyNoteWidget, StickyNoteWidgetDefinition } from './widget';

describe('StickyNoteWidget', () => {
    it('updates note content through updateSettings', () => {
        const updateSettings = vi.fn();

        render(
            <StickyNoteWidget
                widgetId="sticky-1"
                settings={{ title: 'Todo', content: 'Initial', accentColor: '#10b981', showTitle: true, showCharCount: true }}
                updateSettings={updateSettings}
            />
        );

        fireEvent.change(screen.getByPlaceholderText('Write your note here...'), {
            target: { value: 'Updated content' },
        });

        expect(updateSettings).toHaveBeenCalledWith({
            title: 'Todo',
            content: 'Updated content',
            accentColor: '#10b981',
            showTitle: true,
            showCharCount: true,
        });
    });

    it('applies side accent color without tinting the whole note background', () => {
        const { container } = render(
            <StickyNoteWidget
                widgetId="sticky-2"
                settings={{ title: '', content: '', accentColor: '#f43f5e', showTitle: false, showCharCount: true }}
                updateSettings={vi.fn()}
            />
        );

        const surface = container.firstElementChild as HTMLElement | null;
        expect(surface).toBeTruthy();
        expect(surface).toHaveClass('bg-card/40');
        expect(surface?.style.backgroundColor).toBe('');

        const accent = surface?.querySelector('[data-note-accent]') as HTMLElement | null;
        expect(accent).toBeTruthy();
        expect(accent?.style.backgroundColor).toBe('rgb(244, 63, 94)');
        expect(accent).toHaveClass('h-5');
        expect(accent).toHaveClass('w-1');
    });

    it('clears title and content through header clear action', () => {
        const clearAction = StickyNoteWidgetDefinition.headerButtons?.find((button) => button.id === 'clear');
        const updateSettings = vi.fn();
        let confirmAction: (() => void | Promise<void>) | null = null;

        if (!clearAction) {
            throw new Error('Missing sticky note clear action');
        }

        const confirmNode = clearAction.render(
            {
                widgetId: 'sticky-1',
                settings: { title: 'Title', content: 'Body', accentColor: '#f43f5e', showTitle: true, showCharCount: false },
                updateSettings,
            },
            {
                ActionButton: () => null,
                ConfirmActionButton: (props) => {
                    confirmAction = props.onClick;
                    return null;
                },
            }
        );
        render(<>{confirmNode}</>);

        if (!confirmAction) {
            throw new Error('Missing confirm action callback');
        }
        const runConfirm = confirmAction as (() => void | Promise<void>);
        void runConfirm();

        expect(updateSettings).toHaveBeenCalledWith({
            title: '',
            content: '',
            accentColor: '#f43f5e',
            showTitle: true,
            showCharCount: false,
        });
    });

    it('hides character count when showCharCount is disabled', () => {
        render(
            <StickyNoteWidget
                widgetId="sticky-3"
                settings={{ title: 'Todo', content: 'Hello', accentColor: '#0ea5e9', showTitle: true, showCharCount: false }}
                updateSettings={vi.fn()}
            />
        );

        expect(screen.queryByText('5 chars')).not.toBeInTheDocument();
    });

    it('keeps textarea horizontal overflow hidden and vertical overflow scrollable', () => {
        render(
            <StickyNoteWidget
                widgetId="sticky-4"
                settings={{ title: 'Todo', content: 'Hello', accentColor: '#0ea5e9', showTitle: true, showCharCount: true }}
                updateSettings={vi.fn()}
            />
        );

        const textarea = screen.getByPlaceholderText('Write your note here...');
        expect(textarea).toHaveClass('overflow-x-hidden');
        expect(textarea).toHaveClass('overflow-y-auto');
        expect(textarea).toHaveClass('[field-sizing:fixed]');
    });
});
