import React from 'react';

interface ProgressBarProps {
    value: number;
    max: number;
    color?: string;
    height?: string;
    className?: string;
    showPercentage?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
    value,
    max,
    color = 'var(--color-primary)',
    height = '0.5rem',
    className = '',
    showPercentage = false
}) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
        <div className={`progress-bar-wrapper ${className}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div 
                className="progress-bar-container" 
                style={{ 
                    height, 
                    backgroundColor: 'rgba(0,0,0,0.05)', 
                    borderRadius: '999px',
                    flex: 1,
                    overflow: 'hidden'
                }}
            >
                <div 
                    className="progress-bar-fill"
                    style={{
                        width: `${percentage}%`,
                        height: '100%',
                        backgroundColor: color,
                        borderRadius: '999px',
                        transition: 'width 0.5s ease-out'
                    }}
                />
            </div>
            {showPercentage && (
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', minWidth: '3ch' }}>
                    {Math.round(percentage)}%
                </span>
            )}
        </div>
    );
};
