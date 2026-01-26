import clsx from 'clsx';

interface ContainerProps {
    children: React.ReactNode;
    maxWidth?: string;
    padding?: string;
    style?: React.CSSProperties;
    className?: string;
}

export const Container: React.FC<ContainerProps> = ({ 
    children, 
    maxWidth = '1200px', 
    padding,
    style,
    className
}) => {
    return (
        <div
            className={clsx('responsive-container', className)}
            style={{
                maxWidth,
                margin: '0 auto',
                ...(padding ? { padding } : {}),
                width: '100%',
                boxSizing: 'border-box',
                ...style
            }}
        >
            {children}
        </div>
    );
};
