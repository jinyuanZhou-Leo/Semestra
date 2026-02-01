

interface TabSwitchOption<T extends string> {
    value: T;
    label: string;
}

interface TabSwitchProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: Array<TabSwitchOption<T>>;
}

export function TabSwitch<T extends string>({
    value,
    onChange,
    options
}: TabSwitchProps<T>) {
    return (
        <div
            style={{
                display: 'flex',
                padding: '0.25rem',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                gap: '0.25rem',
                width: '100%'
            }}
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    style={{
                        flex: 1,
                        padding: '0.5rem 1rem',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        background: value === option.value ? 'var(--color-bg-primary)' : 'transparent',
                        color: value === option.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        boxShadow: value === option.value ? 'var(--shadow-sm)' : 'none',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        transition: 'all 0.2s',
                        userSelect: 'none',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
