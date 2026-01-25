import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';

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
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleLogin}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 1000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                backgroundColor: 'var(--color-bg-primary)',
                                borderRadius: 'var(--radius-lg)',
                                padding: '2rem',
                                maxWidth: '400px',
                                width: '90%',
                                boxShadow: 'var(--shadow-lg)',
                                border: '1px solid var(--color-border)',
                                textAlign: 'center'
                            }}
                        >
                            {/* Icon */}
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem'
                            }}>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="32"
                                    height="32"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="var(--color-danger)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                            </div>

                            <h2 style={{
                                margin: '0 0 0.5rem',
                                fontSize: '1.5rem',
                                fontWeight: 700
                            }}>
                                Session Expired
                            </h2>

                            <p style={{
                                color: 'var(--color-text-secondary)',
                                marginBottom: '1.5rem',
                                lineHeight: 1.6
                            }}>
                                Your session has expired for security reasons. Please log in again to continue.
                            </p>

                            <Button onClick={handleLogin} fullWidth>
                                Log In Again
                            </Button>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
