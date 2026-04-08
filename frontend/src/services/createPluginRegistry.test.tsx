import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createPluginRegistry } from './createPluginRegistry';
import type { TabProps } from './tabRegistry';
import type { WidgetProps } from './widgetRegistry';
import { jsonDeepEqual } from '../plugin-system/utils';

describe('createPluginRegistry', () => {
  it('keeps default memoization for tabs without a custom comparator', () => {
    const renderSpy = vi.fn();
    const TabComponent: React.FC<TabProps> = (props) => {
      renderSpy(props);
      return <div>{props.tabId}</div>;
    };

    const { registry } = createPluginRegistry<
      { type: string; component: React.FC<TabProps> },
      TabProps
    >('Tab', 'tabId');
    registry.register({ type: 'demo-tab', component: TabComponent });
    const RegisteredComponent = registry.getComponent('demo-tab');

    expect(RegisteredComponent).toBeDefined();
    if (!RegisteredComponent) {
      throw new Error('Expected tab component to be registered.');
    }

    const { rerender } = render(<RegisteredComponent tabId="tab-1" semesterId="semester-1" />);
    rerender(<RegisteredComponent tabId="tab-1" semesterId="semester-1" />);

    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it('allows widgets to re-render when settings change', () => {
    const renderSpy = vi.fn();
    const WidgetComponent: React.FC<WidgetProps<{ count: number }>> = (props) => {
      renderSpy(props.settings);
      return <div>count:{props.settings.count}</div>;
    };

    const { registry } = createPluginRegistry<
      { type: string; component: React.FC<WidgetProps<{ count: number }>> },
      WidgetProps<{ count: number }>
    >(
      'Widget',
      'widgetId',
      (prevProps, nextProps, idPropKey) => (
        prevProps[idPropKey] === nextProps[idPropKey] &&
        prevProps.semesterId === nextProps.semesterId &&
        prevProps.courseId === nextProps.courseId &&
        prevProps.updateSettings === nextProps.updateSettings &&
        prevProps.updateCourse === nextProps.updateCourse &&
        jsonDeepEqual(prevProps.settings, nextProps.settings)
      ),
    );

    registry.register({ type: 'demo-widget', component: WidgetComponent });
    const RegisteredComponent = registry.getComponent('demo-widget');

    expect(RegisteredComponent).toBeDefined();
    if (!RegisteredComponent) {
      throw new Error('Expected widget component to be registered.');
    }

    const updateSettings = vi.fn();
    const { rerender } = render(
      <RegisteredComponent
        widgetId="widget-1"
        settings={{ count: 1 }}
        semesterId="semester-1"
        updateSettings={updateSettings}
      />,
    );

    expect(screen.getByText('count:1')).toBeInTheDocument();

    rerender(
      <RegisteredComponent
        widgetId="widget-1"
        settings={{ count: 2 }}
        semesterId="semester-1"
        updateSettings={updateSettings}
      />,
    );

    expect(screen.getByText('count:2')).toBeInTheDocument();
    expect(renderSpy).toHaveBeenCalledTimes(2);
  });
});
