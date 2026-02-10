import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock } from 'lucide-react';

interface SessionExpiredModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate();

    const handleLogin = () => {
        onClose();
        navigate('/login');
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleLogin()}>
            <DialogContent className="p-0 sm:max-w-[400px]">
                <DialogHeader className="sr-only">
                    <DialogTitle>Session Expired</DialogTitle>
                    <DialogDescription>
                        Your session expired and you need to log in again to continue.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center p-8 text-center">
                    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                        <Clock className="h-8 w-8 text-destructive" />
                    </div>

                    <h2 className="mb-2 text-2xl font-bold tracking-tight">
                        Session Expired
                    </h2>

                    <p className="mb-6 text-muted-foreground leading-relaxed">
                        Your session has expired for security reasons. Please log in again to continue.
                    </p>

                    <Button onClick={handleLogin} className="w-full">
                        Log In Again
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
