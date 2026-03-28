// input:  [frontend Vite SSR module loading plus plugin setup/metadata registry exports]
// output: [generated backend plugin setup and metadata manifest JSON files]
// pos:    [build-time bridge that materializes frontend-authored plugin setup DSL plus plugin metadata into backend/generated manifests]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(FRONTEND_ROOT, "..");
const SETUP_OUTPUT_FILE = path.resolve(REPO_ROOT, "backend/generated/plugin_setup_manifest.json");
const METADATA_OUTPUT_FILE = path.resolve(REPO_ROOT, "backend/generated/plugin_metadata_manifest.json");

const viteServer = await createServer({
  configFile: path.resolve(FRONTEND_ROOT, "vite.config.ts"),
  root: FRONTEND_ROOT,
  logLevel: "silent",
  server: {
    middlewareMode: true,
  },
  appType: "custom",
});

try {
  const setupRegistryModule = await viteServer.ssrLoadModule("/src/plugin-system/setupRegistry.ts");
  const metadataManifestModule = await viteServer.ssrLoadModule("/src/plugin-system/metadataManifest.ts");
  const manifest = setupRegistryModule.buildPluginSetupManifest();
  const metadataManifest = metadataManifestModule.buildPluginMetadataManifest();
  const serializedSetupManifest = `${JSON.stringify(manifest, null, 2)}\n`;
  const serializedMetadataManifest = `${JSON.stringify(metadataManifest, null, 2)}\n`;

  await mkdir(path.dirname(SETUP_OUTPUT_FILE), { recursive: true });

  let currentSetupManifest = "";
  try {
    currentSetupManifest = await readFile(SETUP_OUTPUT_FILE, "utf8");
  } catch {
    currentSetupManifest = "";
  }

  if (currentSetupManifest !== serializedSetupManifest) {
    await writeFile(SETUP_OUTPUT_FILE, serializedSetupManifest, "utf8");
  }

  let currentMetadataManifest = "";
  try {
    currentMetadataManifest = await readFile(METADATA_OUTPUT_FILE, "utf8");
  } catch {
    currentMetadataManifest = "";
  }

  if (currentMetadataManifest !== serializedMetadataManifest) {
    await writeFile(METADATA_OUTPUT_FILE, serializedMetadataManifest, "utf8");
  }
} finally {
  await viteServer.close();
}
