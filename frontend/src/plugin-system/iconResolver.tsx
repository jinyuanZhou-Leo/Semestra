// input:  [descriptor icon strings or icon components, frontend asset maps, React element factory, and image-icon guards]
// output: [`resolvePluginIcon()` helper that converts descriptor icon sources into catalog-ready React nodes]
// pos:    [Descriptor icon adapter that renders typed manifest icons without full-package lucide imports while preserving checked-in image asset resolution]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { createElement, type ReactNode } from 'react';

import type { PluginIconComponent, PluginIconDefinition } from '@/plugin-sdk';
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

const isIconComponent = (icon: PluginIconDefinition): icon is PluginIconComponent => (
  typeof icon !== 'string' && icon !== null
);

export const resolvePluginIcon = (icon?: PluginIconDefinition): ReactNode | undefined => {
  if (!icon) {
    return undefined;
  }
  if (isIconComponent(icon)) {
    return createElement(icon, { className: 'h-4 w-4' });
  }
  if (isImageIcon(icon)) {
    return createElement('img', {
      alt: '',
      'aria-hidden': true,
      className: 'h-4 w-4 object-contain',
      src: resolveImageIconSource(icon),
    });
  }
  return undefined;
};
