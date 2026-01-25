import { WidgetRegistry } from './services/widgetRegistry';
import { CourseListWidgetDefinition } from './plugins/CourseListWidget';
import { CounterWidgetDefinition } from './plugins/CounterWidget';
import { WorldClockWidgetDefinition } from './plugins/WorldClockWidget';
import { GradeCalculatorPluginDefinition } from './plugins/GradeCalculatorPlugin';

// Register built-in widgets
WidgetRegistry.register(CourseListWidgetDefinition);
WidgetRegistry.register(CounterWidgetDefinition);
WidgetRegistry.register(WorldClockWidgetDefinition);
WidgetRegistry.register(GradeCalculatorPluginDefinition);

console.log('Widgets registered:', WidgetRegistry.getAll().map(w => w.type));
