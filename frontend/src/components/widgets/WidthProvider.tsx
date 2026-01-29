import { useEffect, useRef, useState } from 'react';

export const WidthProvider = (ComposedComponent: any) => {
    const WithWidth = (props: any) => {
        const [width, setWidth] = useState(1200);
        const elementRef = useRef<HTMLDivElement>(null);
        const mountedRef = useRef(false);

        useEffect(() => {
            mountedRef.current = true;
            const element = elementRef.current;
            if (!element) return;

            const resizeObserver = new ResizeObserver((entries) => {
                if (!mountedRef.current) return;
                for (const entry of entries) {
                    setWidth(entry.contentRect.width);
                }
            });

            resizeObserver.observe(element);

            // Set initial width
            setWidth(element.offsetWidth);

            return () => {
                mountedRef.current = false;
                resizeObserver.disconnect();
            };
        }, []);

        return (
            <div ref={elementRef} className={props.className} style={{ width: '100%' }}>
                <ComposedComponent {...props} width={width} />
            </div>
        );
    };

    return WithWidth;
};
