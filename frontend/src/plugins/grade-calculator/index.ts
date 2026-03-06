import { definePluginRuntime } from '../../plugin-system/contracts';

import { GradeCalculatorDefinition } from './widget';

export default definePluginRuntime({
    widgetDefinitions: [GradeCalculatorDefinition],
});
