import React from 'react';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
    to?: string; // Optional custom path, otherwise go back
    label?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ to, label = 'Back' }) => {
    const navigate = useNavigate();

    const handleClick = () => {
        if (to) {
            navigate(to);
        } else {
            navigate(-1);
        }
    };

    return (
        <button
            onClick={handleClick}
            style={{
                background: 'none',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                padding: '0.5rem 0',
                marginBottom: '1rem',
                fontWeight: 500,
                transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            {label}
        </button>
    );
};
