import { WidgetRegistry } from './services/widgetRegistry';
import { CourseListDefinition } from './plugins/CourseList';
import { CounterDefinition } from './plugins/Counter';
import { WorldClockDefinition } from './plugins/WorldClock';
import { GradeCalculatorDefinition } from './plugins/GradeCalculator';

// Register built-in widgets
WidgetRegistry.register(CourseListDefinition);
WidgetRegistry.register(CounterDefinition);
WidgetRegistry.register(WorldClockDefinition);
WidgetRegistry.register(GradeCalculatorDefinition);

console.log('Widgets registered:', WidgetRegistry.getAll().map(w => w.type));
