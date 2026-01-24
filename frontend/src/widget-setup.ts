import { WidgetRegistry } from './services/widgetRegistry';
import { CourseListWidgetDefinition } from './plugins/CourseListWidget';
import { CounterWidgetDefinition } from './plugins/CounterWidget';

// Register built-in widgets
WidgetRegistry.register(CourseListWidgetDefinition);
WidgetRegistry.register(CounterWidgetDefinition);

console.log('Widgets registered:', WidgetRegistry.getAll().map(w => w.type));
