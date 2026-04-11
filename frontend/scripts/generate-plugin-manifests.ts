// input:  [typed plugin entry source files, lucide icon exports, and backend generated-artifact paths]
// output: [backend-readable generated plugin descriptor and setup-schema JSON artifacts]
// pos:    [Build/dev script that serializes TypeScript-authored plugin entries into deterministic backend manifest files]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as LucideIcons from 'lucide-react';
import { build } from 'vite';

import type {
  PluginDescriptor,
  PluginDescriptorSetupSchema,
  PluginIconComponent,
  PluginIconDefinition,
  SerializedPluginDescriptor,
} from '../src/plugin-sdk/manifest-types.ts';
import type { PluginDefinition } from '../src/plugin-sdk/types.ts';

type PluginModule = {
  default?: PluginDefinition;
};

type GeneratedArtifact = {
  filename: string;
  content: string;
};

const CURRENT_FILE_PATH = fileURLToPath(import.meta.url);
const SCRIPTS_DIR = path.dirname(CURRENT_FILE_PATH);
const FRONTEND_ROOT = path.resolve(SCRIPTS_DIR, '..');
const PLUGINS_ROOT = path.join(FRONTEND_ROOT, 'src', 'plugins');
const OUTPUT_ROOT = path.resolve(FRONTEND_ROOT, '..', 'backend', 'generated', 'plugin-manifests');

const lucideNameByComponent = new Map<PluginIconComponent, string>(
  Object.entries(LucideIcons)
    .filter(([, value]) => typeof value === 'function')
    .map(([name, value]) => [value as unknown as PluginIconComponent, name]),
);

const toKebabCase = (value: string) => (
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
);

const toJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const serializeIcon = (icon?: PluginIconDefinition): string | undefined => {
  if (!icon) {
    return undefined;
  }
  if (typeof icon === 'string') {
    return icon;
  }
  const lucideName = lucideNameByComponent.get(icon)
    ?? (typeof icon.displayName === 'string' && icon.displayName.trim() ? icon.displayName.trim() : undefined)
    ?? (typeof icon.name === 'string' && icon.name.trim() ? icon.name.trim() : undefined);
  if (!lucideName) {
    throw new Error('[plugin-manifest] Manifest icons must be image strings or direct lucide-react exports.');
  }
  return toKebabCase(lucideName);
};

const serializePluginManifest = (manifest: PluginDescriptor): SerializedPluginDescriptor => ({
  id: manifest.id,
  display_name: manifest.display_name,
  author: manifest.author,
  description: manifest.description,
  long_description: manifest.long_description,
  icon: serializeIcon(manifest.icon),
  tabs: manifest.tabs?.map((tab) => ({
    ...tab,
    icon: serializeIcon(tab.icon),
    contexts: [...tab.contexts],
  })),
  widgets: manifest.widgets?.map((widget) => ({
    ...widget,
    icon: serializeIcon(widget.icon),
    contexts: [...widget.contexts],
    layout: widget.layout ? { ...widget.layout } : undefined,
  })),
  settings: {
    panels: (manifest.settings?.panels ?? []).map((section) => ({
      ...section,
      contexts: [...section.contexts],
    })),
  },
});

const serializeSetupSchema = (schema: PluginDescriptorSetupSchema): PluginDescriptorSetupSchema => ({
  sections: schema.sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => ({
      ...field,
      options: field.options?.map((option) => ({ ...option })),
      summary_labels: { ...field.summary_labels },
    })),
  })),
  validation_rules: [...(schema.validation_rules ?? [])],
});

const ensureRootIndex = async () => {
  const indexPath = path.join(OUTPUT_ROOT, 'INDEX.md');
  try {
    await stat(indexPath);
  } catch {
    throw new Error(`[plugin-manifest] Missing generated-manifest index at "${indexPath}".`);
  }
};

const cleanGeneratedArtifacts = async () => {
  const existingEntries = await readdir(OUTPUT_ROOT);
  await Promise.all(
    existingEntries
      .filter((entry) => entry !== 'INDEX.md')
      .map((entry) => rm(path.join(OUTPUT_ROOT, entry), { force: true, recursive: true })),
  );
};

const main = async () => {
  await mkdir(OUTPUT_ROOT, { recursive: true });
  await ensureRootIndex();
  const generatedArtifacts: GeneratedArtifact[] = [];
  const tempBuildRoot = await mkdtemp(path.join(FRONTEND_ROOT, '.plugin-manifest-build-'));

  try {
    const pluginEntries = await readdir(PLUGINS_ROOT, { withFileTypes: true });
    const seenPluginIds = new Set<string>();

    for (const pluginEntry of pluginEntries) {
      if (!pluginEntry.isDirectory()) {
        continue;
      }

      const pluginPath = path.join(PLUGINS_ROOT, pluginEntry.name, 'plugin.ts');
      try {
        await stat(pluginPath);
      } catch {
        continue;
      }

      const pluginBuildDir = path.join(tempBuildRoot, pluginEntry.name);
      await build({
        root: FRONTEND_ROOT,
        configFile: false,
        logLevel: 'silent',
        resolve: {
          alias: {
            '@': path.join(FRONTEND_ROOT, 'src'),
          },
        },
        build: {
          ssr: pluginPath,
          outDir: pluginBuildDir,
          emptyOutDir: true,
          minify: false,
          sourcemap: false,
          target: 'node20',
          copyPublicDir: false,
          reportCompressedSize: false,
          rollupOptions: {
            output: {
              format: 'esm',
              entryFileNames: 'plugin.js',
            },
          },
        },
      });

      const pluginModule = await import(
        `${pathToFileURL(path.join(pluginBuildDir, 'plugin.js')).href}?t=${Date.now()}`
      ) as PluginModule;
      const definition = pluginModule.default;
      if (!definition) {
        throw new Error(`[plugin-manifest] "${pluginPath}" must default-export a plugin definition.`);
      }
      const manifest = definition.descriptor;
      if (manifest.id !== pluginEntry.name) {
        throw new Error(
          `[plugin-manifest] Plugin folder "${pluginEntry.name}" must export id "${pluginEntry.name}", received "${manifest.id}".`,
        );
      }
      if (seenPluginIds.has(manifest.id)) {
        throw new Error(`[plugin-manifest] Duplicate plugin id "${manifest.id}".`);
      }
      seenPluginIds.add(manifest.id);

      generatedArtifacts.push({
        filename: `${manifest.id}.plugin.json`,
        content: toJson(serializePluginManifest(manifest)),
      });

      if (definition.setup?.schema) {
        generatedArtifacts.push({
          filename: `${manifest.id}.setup.schema.json`,
          content: toJson(serializeSetupSchema(definition.setup.schema)),
        });
      }
    }
  } finally {
    await rm(tempBuildRoot, { force: true, recursive: true });
  }

  const manifestFiles = generatedArtifacts.filter((entry) => entry.filename.endsWith('.plugin.json'));
  if (manifestFiles.length === 0) {
    throw new Error('[plugin-manifest] No plugin manifests were generated.');
  }

  await cleanGeneratedArtifacts();
  await Promise.all(
    generatedArtifacts.map((artifact) => writeFile(
      path.join(OUTPUT_ROOT, artifact.filename),
      artifact.content,
      'utf-8',
    )),
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
