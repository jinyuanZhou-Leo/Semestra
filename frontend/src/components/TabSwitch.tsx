

import { cn } from "@/lib/utils";

interface TabSwitchOption<T extends string> {
    value: T;
    label: string;
}

interface TabSwitchProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: Array<TabSwitchOption<T>>;
    className?: string;
}

export function TabSwitch<T extends string>({
    value,
    onChange,
    options,
    className
}: TabSwitchProps<T>) {
    return (
        <div
            className={cn(
                "flex p-1 bg-muted rounded-lg gap-1 w-full",
                className
            )}
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        "flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all select-none whitespace-nowrap",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        value === option.value
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
