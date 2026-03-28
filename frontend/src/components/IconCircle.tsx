// input:  [icon source (ReactNode or image URL), size/label props, class overrides, and `isImageIcon` guard]
// output: [`IconCircle` component]
// pos:    [Unified circular icon/avatar renderer across catalog and dashboard UI, including full-bleed image icons and more restrained vector icon scaling]
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

interface IconElementProps {
    className?: string;
    style?: React.CSSProperties;
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
    const glyphSize = Math.max(16, Math.floor(size * 0.46));
    const renderedIcon = React.isValidElement<IconElementProps>(icon)
        ? React.cloneElement(icon, {
            className: cn(icon.props.className, "h-full w-full"),
            style: {
                ...(icon.props.style ?? {}),
                width: "100%",
                height: "100%",
            },
        })
        : icon;

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
                <span
                    className="inline-flex items-center justify-center"
                    style={{ width: glyphSize, height: glyphSize, fontSize: glyphSize }}
                >
                    {renderedIcon}
                </span>
            )}
        </span>
    );
};
