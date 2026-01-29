import React from 'react';
import { isImageIcon } from '../utils/icon';

interface IconCircleProps {
    icon?: React.ReactNode;
    label: string;
    size?: number;
}

export const IconCircle: React.FC<IconCircleProps> = ({
    icon,
    label,
    size = 28
}) => {
    const fallbackText = (label || '?').trim().charAt(0).toUpperCase() || '?';
    const innerSize = Math.max(12, Math.round(size * 0.6));
    const isImage = typeof icon === 'string' && isImageIcon(icon);
    const showPlaceholder = !icon;

    return (
        <span
            aria-hidden="true"
            style={{
                width: size,
                height: size,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                flexShrink: 0
            }}
        >
            {isImage ? (
                <img
                    src={icon as string}
                    alt=""
                    width={innerSize}
                    height={innerSize}
                    style={{ width: innerSize, height: innerSize, objectFit: 'contain', borderRadius: '50%', display: 'block' }}
                />
            ) : showPlaceholder ? (
                <span style={{ fontSize: Math.max(12, Math.floor(size * 0.5)), fontWeight: 700 }}>
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
