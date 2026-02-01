import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  const version = process.env.npm_package_version || '0.0.0';
  
  const versionInfo = {
    version,
    branch,
    commit,
    buildTime: new Date().toISOString()
  };

  const outputPath = join(__dirname, '..', 'src', 'version.json');
  writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2));
  
  console.log('✓ Version info generated:', versionInfo);
} catch (error) {
  console.warn('⚠ Could not generate version info:', error.message);
  // Fallback version info
  const fallbackInfo = {
    version: process.env.npm_package_version || '0.0.0',
    branch: 'unknown',
    commit: 'unknown',
    buildTime: new Date().toISOString()
  };
  const outputPath = join(__dirname, '..', 'src', 'version.json');
  writeFileSync(outputPath, JSON.stringify(fallbackInfo, null, 2));
}
