// input:  [icon source (ReactNode or image URL), size/label props, class overrides, and `isImageIcon` guard]
// output: [`IconCircle` component]
// pos:    [Unified circular icon/avatar renderer across catalog and dashboard UI, including full-bleed image icons]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import { isImageIcon } from '../utils/icon';
import { cn } from '@/lib/utils';

interface IconCircleProps {
    icon?: React.ReactNode;
    label: string;
    size?: number;
    className?: string; // Allow external class overrides
}

export const IconCircle: React.FC<IconCircleProps> = ({
    icon,
    label,
    size = 28,
    className
}) => {
    const fallbackText = (label || '?').trim().charAt(0).toUpperCase() || '?';
    const isImage = typeof icon === 'string' && isImageIcon(icon);
    const showPlaceholder = !icon;

    return (
        <span
            aria-hidden="true"
            className={cn(
                "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-secondary text-primary",
                className
            )}
            style={{
                width: size,
                height: size
            }}
        >
            {isImage ? (
                <img
                    src={icon as string}
                    alt=""
                    width={size}
                    height={size}
                    className="block h-full w-full object-cover"
                    style={{ width: size, height: size }}
                />
            ) : showPlaceholder ? (
                    <span className="font-bold" style={{ fontSize: Math.max(12, Math.floor(size * 0.5)) }}>
                    {fallbackText}
                </span>
            ) : (
                <span style={{ fontSize: Math.max(12, Math.floor(size * 0.55)) }}>
                    {icon}
                </span>
            )}
        </span>
    );
};
