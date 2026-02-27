// input:  [open state + change callback, viewport breakpoint state, title/description metadata, dialog/drawer surface classes, body/footer content]
// output: [`ResponsiveDialogDrawer` component]
// pos:    [Shared responsive overlay wrapper that renders Dialog on desktop and Drawer on mobile]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ResponsiveDialogDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    desktopContentClassName?: string;
    mobileContentClassName?: string;
    desktopHeaderClassName?: string;
    mobileHeaderClassName?: string;
    desktopFooterClassName?: string;
    mobileFooterClassName?: string;
    titleClassName?: string;
    descriptionClassName?: string;
}

export const ResponsiveDialogDrawer: React.FC<ResponsiveDialogDrawerProps> = ({
    open,
    onOpenChange,
    title,
    description,
    children,
    footer,
    desktopContentClassName,
    mobileContentClassName,
    desktopHeaderClassName,
    mobileHeaderClassName,
    desktopFooterClassName,
    mobileFooterClassName,
    titleClassName,
    descriptionClassName,
}) => {
    const isMobile = useIsMobile();

    React.useEffect(() => {
        if (!open || typeof document === 'undefined') return;

        const focusIntoOverlay = () => {
            const activeElement = document.activeElement as HTMLElement | null;
            const selector = isMobile ? '[data-slot="drawer-content"]' : '[data-slot="dialog-content"]';
            const overlayContent = document.querySelector<HTMLElement>(selector);
            if (!overlayContent) return;

            if (activeElement && overlayContent.contains(activeElement)) return;
            if (activeElement) activeElement.blur();
            overlayContent.focus({ preventScroll: true });
        };

        const rafId = window.requestAnimationFrame(focusIntoOverlay);
        return () => window.cancelAnimationFrame(rafId);
    }, [open, isMobile]);

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent tabIndex={-1} className={mobileContentClassName}>
                    <DrawerHeader className={cn("text-left", mobileHeaderClassName)}>
                        <DrawerTitle className={titleClassName}>{title}</DrawerTitle>
                        {description ? (
                            <DrawerDescription className={descriptionClassName}>
                                {description}
                            </DrawerDescription>
                        ) : null}
                    </DrawerHeader>
                    {children}
                    {footer ? (
                        <DrawerFooter className={mobileFooterClassName}>
                            {footer}
                        </DrawerFooter>
                    ) : null}
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent tabIndex={-1} className={desktopContentClassName}>
                <DialogHeader className={desktopHeaderClassName}>
                    <DialogTitle className={titleClassName}>{title}</DialogTitle>
                    {description ? (
                        <DialogDescription className={descriptionClassName}>
                            {description}
                        </DialogDescription>
                    ) : null}
                </DialogHeader>
                {children}
                {footer ? (
                    <DialogFooter className={desktopFooterClassName}>
                        {footer}
                    </DialogFooter>
                ) : null}
            </DialogContent>
        </Dialog>
    );
};
