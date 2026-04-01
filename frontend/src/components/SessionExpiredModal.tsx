// input:  [session-expired open state, close callback, and router navigation to login]
// output: [`SessionExpiredModal` component]
// pos:    [Auth-expiration dialog forcing a user back into login flow while preserving the remembered return route]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

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
        navigate('/login', { replace: true });
    };

    return (
        <Dialog open={isOpen}>
            <DialogContent
                showCloseButton={false}
                onEscapeKeyDown={(event) => event.preventDefault()}
                onInteractOutside={(event) => event.preventDefault()}
                className="p-0 sm:max-w-[400px]"
            >
                <div className="flex flex-col items-center p-8 text-center">
                    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                        <Clock className="h-8 w-8 text-destructive" />
                    </div>

                    <DialogHeader className="mb-6 items-center gap-2">
                        <DialogTitle className="text-2xl font-semibold tracking-tight">
                            Session Expired
                        </DialogTitle>
                        <DialogDescription className="leading-relaxed">
                            Your session has expired for security reasons. Please log in again to continue.
                        </DialogDescription>
                    </DialogHeader>

                    <Button onClick={handleLogin} className="w-full">
                        Log In Again
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
