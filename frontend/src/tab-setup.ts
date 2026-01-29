import { TabRegistry } from './services/tabRegistry';

// Register tab plugins here.
// Example:
// TabRegistry.register(MyTabDefinition);

console.log('Tabs registered:', TabRegistry.getAll().map(t => t.type));
