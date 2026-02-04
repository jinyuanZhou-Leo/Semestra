import React, { useId } from "react";
import { RadioGroup as UiRadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

interface RadioOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface RadioGroupProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: RadioOption<T>[];
  name?: string;
  disabled?: boolean;
}

export function RadioGroup<T extends string>({
  value,
  onChange,
  options,
  name,
  disabled,
}: RadioGroupProps<T>) {
  const generatedName = useId();
  const groupName = name ?? `radio-group-${generatedName}`;
  const baseId = useId();

  return (
    <UiRadioGroup
      value={value}
      onValueChange={(nextValue) => onChange(nextValue as T)}
      name={groupName}
      className="flex flex-col gap-2"
      disabled={disabled}
    >
      {options.map((option, index) => (
        <Radio
          key={option.value}
          id={`${baseId}-${index}`}
          value={option.value}
          label={option.label}
          description={option.description}
          checked={value === option.value}
          disabled={disabled}
        />
      ))}
    </UiRadioGroup>
  );
}

interface RadioProps {
  id: string;
  value: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
}

export const Radio: React.FC<RadioProps> = ({
  id,
  value,
  label,
  description,
  checked,
  disabled,
}) => {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 rounded-md border p-3 transition-colors",
        checked ? "bg-secondary" : "bg-transparent",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:bg-accent"
      )}
    >
      <RadioGroupItem
        id={id}
        value={value}
        className="mt-0.5"
        disabled={disabled}
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {description}
          </div>
        )}
      </div>
    </label>
  );
};
