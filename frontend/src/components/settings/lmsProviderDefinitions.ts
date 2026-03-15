// input:  [LMS integration API response contracts and provider-specific assets]
// output: [supported LMS provider definitions plus provider-specific normalization, payload-building, and masking helpers for settings UIs]
// pos:    [settings-local provider adapter layer that keeps `LmsIntegrationManager` free of Canvas-specific payload keys while preserving Canvas as the only supported LMS UI]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import canvasLogo from '@/assets/canvas-icon.png';
import type { LmsIntegrationResponse } from '@/services/api';

export type SupportedLmsProvider = 'canvas';

export interface LmsProviderDefinition {
  value: SupportedLmsProvider;
  label: string;
  logoSrc: string;
  logoAlt: string;
  instanceUrlLabel: string;
  instanceUrlPlaceholder: string;
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  description: string;
  normalizeInstanceUrl: (value: string) => string | null;
  validateCredential: (value: string) => boolean;
  getInstanceUrl: (integration: LmsIntegrationResponse) => string;
  buildConfig: (instanceUrl: string) => Record<string, unknown>;
  buildCredentials: (apiKey: string) => Record<string, unknown>;
  maskCredential: (value: string) => string;
}

const normalizeCanvasBaseUrl = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (!parsed.hostname || parsed.search || parsed.hash) return null;
    if (parsed.pathname.replace(/\/+$/, '') === '/api/v1') return null;
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString();
  } catch {
    return null;
  }
};

const validateCanvasApiKey = (value: string) => {
  if (!value) return false;
  if (value.includes('@') || /\s/.test(value)) return false;
  return value.length >= 8;
};

const maskApiKey = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const visiblePrefix = trimmed.slice(0, 4);
  const hiddenLength = Math.max(4, trimmed.length - visiblePrefix.length);
  return `${visiblePrefix}${'*'.repeat(hiddenLength)}`;
};

const CANVAS_PROVIDER_DEFINITION: LmsProviderDefinition = {
  value: 'canvas',
  label: 'Canvas',
  logoSrc: canvasLogo,
  logoAlt: 'Canvas',
  instanceUrlLabel: 'Instance URL',
  instanceUrlPlaceholder: 'https://canvas.instructure.com/',
  apiKeyLabel: 'API Key',
  apiKeyPlaceholder: 'Paste Canvas API key',
  description: 'Reusable Canvas connections for Program-level LMS binding and Course linking.',
  normalizeInstanceUrl: normalizeCanvasBaseUrl,
  validateCredential: validateCanvasApiKey,
  getInstanceUrl: (integration) => (
    typeof integration.config?.base_url === 'string' ? integration.config.base_url : ''
  ),
  buildConfig: (instanceUrl) => ({ base_url: instanceUrl }),
  buildCredentials: (apiKey) => ({ personal_access_token: apiKey }),
  maskCredential: maskApiKey,
};

const LmsProviderDefinitions: Record<SupportedLmsProvider, LmsProviderDefinition> = {
  canvas: CANVAS_PROVIDER_DEFINITION,
};

export const getDefaultLmsProvider = (): SupportedLmsProvider => 'canvas';

export const getSupportedLmsProviderDefinitions = (): LmsProviderDefinition[] => (
  Object.values(LmsProviderDefinitions)
);

export const getLmsProviderDefinition = (provider: string): LmsProviderDefinition | null => {
  return provider in LmsProviderDefinitions
    ? LmsProviderDefinitions[provider as SupportedLmsProvider]
    : null;
};
