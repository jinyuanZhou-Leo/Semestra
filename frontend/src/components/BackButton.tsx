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
