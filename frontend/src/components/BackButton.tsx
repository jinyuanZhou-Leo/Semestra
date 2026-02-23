// input:  [router navigation functions and optional custom click/path props]
// output: [`BackButton` component]
// pos:    [Shared back navigation control for settings and nested detail screens]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackButtonProps {
    to?: string; // Optional custom path, otherwise go back
    label?: string;
    onClick?: (e: React.MouseEvent) => void;
    className?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ to, label = 'Back', onClick, className }) => {
    const navigate = useNavigate();

    const handleClick = (e: React.MouseEvent) => {
        if (onClick) {
            onClick(e);
            return;
        }

        if (to) {
            navigate(to);
        } else {
            navigate(-1);
        }
    };

    return (
        <Button
            variant="ghost"
            onClick={handleClick}
            className={cn("mb-4 pl-0 hover:bg-transparent hover:text-primary", className)}
        >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {label}
        </Button>
    );
};
