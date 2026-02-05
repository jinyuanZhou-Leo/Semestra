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
    const innerSize = Math.max(12, Math.round(size * 0.6));
    const isImage = typeof icon === 'string' && isImageIcon(icon);
    const showPlaceholder = !icon;

    return (
        <span
            aria-hidden="true"
            className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-full border bg-secondary text-primary",
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
                    width={innerSize}
                    height={innerSize}
                    className="block rounded-full object-contain"
                    style={{ width: innerSize, height: innerSize }}
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
