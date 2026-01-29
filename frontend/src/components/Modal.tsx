import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    contentPadding?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, contentPadding }) => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') onClose();
        };

        if (isOpen) {
            // 保存原始的 overflow 值
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            document.addEventListener('keydown', handleEscape);

            return () => {
                // 恢复原始值而不是使用 'unset'，以确保触屏设备上的滚动功能正常
                document.body.style.overflow = originalOverflow;
                document.removeEventListener('keydown', handleEscape);
            };
        }
    }, [isOpen, onClose]);

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000,
                        backdropFilter: 'blur(4px)',
                        overscrollBehavior: 'contain',
                        touchAction: 'none'
                    }}
                    onClick={(e: React.MouseEvent) => {
                        if (e.target === e.currentTarget) onClose();
                    }}
                >
                    <motion.div
                        ref={modalRef}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        style={{
                            backgroundColor: 'var(--color-bg-primary)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-lg)',
                            width: '90%',
                            maxWidth: '500px',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            overscrollBehavior: 'contain',
                            touchAction: 'pan-y',
                            WebkitOverflowScrolling: 'touch'
                        }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                        {title && (
                            <div style={{
                                padding: '1.25rem 1.5rem',
                                borderBottom: '1px solid var(--color-border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{title}</h2>
                                <button
                                    onClick={onClose}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '1.5rem',
                                        color: 'var(--color-text-secondary)',
                                        cursor: 'pointer',
                                        lineHeight: 1
                                    }}
                                >
                                    &times;
                                </button>
                            </div>
                        )}
                        <div style={{ padding: contentPadding ?? '1.5rem' }}>
                            {children}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};
