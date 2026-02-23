// input:  [wrapped grid component and ResizeObserver width measurements]
// output: [`WidthProvider` HOC returning width-aware wrapper components]
// pos:    [Utility adapter ensuring grid components receive real container width before render]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { useEffect, useRef, useState } from 'react';

export const WidthProvider = (ComposedComponent: any) => {
    const WithWidth = (props: any) => {
        const [width, setWidth] = useState<number | null>(null);
        const elementRef = useRef<HTMLDivElement>(null);
        const mountedRef = useRef(false);

        useEffect(() => {
            mountedRef.current = true;
            const element = elementRef.current;
            if (!element) return;

            // Set initial width immediately
            const initialWidth = element.offsetWidth;
            if (initialWidth > 0) {
                setWidth(initialWidth);
            }

            const resizeObserver = new ResizeObserver((entries) => {
                if (!mountedRef.current) return;
                for (const entry of entries) {
                    const newWidth = entry.contentRect.width;
                    if (newWidth > 0) {
                        setWidth(newWidth);
                    }
                }
            });

            resizeObserver.observe(element);

            return () => {
                mountedRef.current = false;
                resizeObserver.disconnect();
            };
        }, []);

        // Don't render the grid until we have a real width measurement
        if (width === null) {
            return <div ref={elementRef} className={props.className} style={{ width: '100%' }} />;
        }

        return (
            <div ref={elementRef} className={props.className} style={{ width: '100%' }}>
                <ComposedComponent {...props} width={width} />
            </div>
        );
    };

    return WithWidth;
};
