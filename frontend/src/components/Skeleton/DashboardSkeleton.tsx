import React, { useMemo } from 'react';
import { Responsive } from 'react-grid-layout';
import { WidthProvider } from '../widgets/WidthProvider';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Skeleton } from '@/components/ui/skeleton';

const ResponsiveGridLayout = WidthProvider(Responsive);

const calculateSkeletonCount = (): number => {
    const viewportHeight = window.innerHeight;

    // Simple tiered approach based on viewport height
    if (viewportHeight < 600) return 2;   // Mobile - small screen
    if (viewportHeight < 900) return 4;   // Tablet - medium screen
    return 6;                              // Desktop - large screen
};

const generateLayoutForCols = (count: number, totalCols: number, defaultWidth: number) => {
    const layouts = [];
    const defaultH = 4; // Standard widget height

    for (let i = 0; i < count; i++) {
        layouts.push({
            i: `skeleton-${i}`,
            x: (i * defaultWidth) % totalCols,
            y: Math.floor((i * defaultWidth) / totalCols) * defaultH,
            w: Math.min(defaultWidth, totalCols), // Don't exceed total columns
            h: defaultH,
            minW: 2,
            minH: 2,
            static: true // Prevent dragging skeleton items
        });
    }

    return layouts;
};

const generateSkeletonLayouts = (count: number) => {
    return {
        lg: generateLayoutForCols(count, 12, 4),  // 12 cols, width 4
        md: generateLayoutForCols(count, 10, 4),  // 10 cols, width 4
        sm: generateLayoutForCols(count, 6, 3),   // 6 cols, width 3
        xs: generateLayoutForCols(count, 4, 2),   // 4 cols, width 2
        xxs: generateLayoutForCols(count, 2, 2),  // 2 cols, width 2
    };
};

export const DashboardSkeleton: React.FC = () => {
    // Calculate once on mount - no resize listener needed
    const skeletonCount = useMemo(() => calculateSkeletonCount(), []);

    const layouts = useMemo(() => generateSkeletonLayouts(skeletonCount), [skeletonCount]);

    return (
        <ResponsiveGridLayout
            className="layout"
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={60}
            margin={[16, 16]}
            isDraggable={false}
            isResizable={false}
        >
            {Array.from({ length: skeletonCount }, (_, i) => (
                <div key={`skeleton-${i}`} style={{ border: '1px solid transparent' }}>
                    <Skeleton className="h-full w-full rounded-lg" />
                </div>
            ))}
        </ResponsiveGridLayout>
    );
};
