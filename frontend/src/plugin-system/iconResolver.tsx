// input:  [descriptor icon names or image-like icon strings, frontend asset maps, React element factory, lucide icon exports, and image-icon guards]
// output: [`resolvePluginIcon()` helper that converts descriptor icon ids into catalog-ready React nodes]
// pos:    [Descriptor icon adapter that keeps JSON plugin descriptors UI-safe without embedding JSX in static files, including checked-in image asset resolution and dynamic lucide lookup]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement, type ReactNode } from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { isImageIcon } from '@/utils/icon';

const ROOT_ASSET_ICON_MAP = import.meta.glob('../assets/*.{png,jpg,jpeg,svg,webp,gif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const normalizeAssetIconPath = (icon: string): string | undefined => {
  const trimmed = icon.trim();

  if (trimmed.startsWith('@/assets/')) {
    return trimmed.replace('@/assets/', '../assets/');
  }

  if (trimmed.startsWith('/src/assets/')) {
    return trimmed.replace('/src/assets/', '../assets/');
  }

  return undefined;
};

const resolveImageIconSource = (icon: string): string => {
  const normalizedAssetPath = normalizeAssetIconPath(icon);
  if (!normalizedAssetPath) {
    return icon;
  }

  return ROOT_ASSET_ICON_MAP[normalizedAssetPath] ?? icon;
};

const toLucideExportName = (icon: string): string => (
  icon
    .trim()
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('')
);

const resolveLucideIconComponent = (icon: string): LucideIcon | undefined => {
  const exportName = toLucideExportName(icon);
  const candidate = LucideIcons[exportName as keyof typeof LucideIcons];
  return typeof candidate === 'function' ? (candidate as unknown as LucideIcon) : undefined;
};

export const resolvePluginIcon = (icon?: string): ReactNode | undefined => {
  if (!icon) {
    return undefined;
  }
  if (isImageIcon(icon)) {
    return createElement('img', {
      alt: '',
      'aria-hidden': true,
      className: 'h-4 w-4 object-contain',
      src: resolveImageIconSource(icon),
    });
  }

  const IconComponent = resolveLucideIconComponent(icon);
  if (!IconComponent) {
    return undefined;
  }
  return createElement(IconComponent, { className: 'h-4 w-4' });
};
