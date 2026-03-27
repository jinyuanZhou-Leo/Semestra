// input:  [frontend Vite SSR module loading plus plugin setup registry exports]
// output: [generated backend plugin setup manifest JSON file]
// pos:    [build-time bridge that materializes frontend-authored plugin setup DSL into backend/generated/plugin_setup_manifest.json]
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
const OUTPUT_FILE = path.resolve(REPO_ROOT, "backend/generated/plugin_setup_manifest.json");

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
  const manifest = setupRegistryModule.buildPluginSetupManifest();
  const serializedManifest = `${JSON.stringify(manifest, null, 2)}\n`;

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });

  let currentManifest = "";
  try {
    currentManifest = await readFile(OUTPUT_FILE, "utf8");
  } catch {
    currentManifest = "";
  }

  if (currentManifest !== serializedManifest) {
    await writeFile(OUTPUT_FILE, serializedManifest, "utf8");
  }
} finally {
  await viteServer.close();
}
