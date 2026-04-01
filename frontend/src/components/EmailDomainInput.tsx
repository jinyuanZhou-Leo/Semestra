// input:  [controlled email value updates, shared shadcn Combobox and Field-aligned input props, native-browser autocomplete suppression defaults, optional field state props, and optional domain-suggestion overrides]
// output: [`EmailDomainInput` controlled auth-form input component]
// pos:    [Shared auth-oriented email field that uses shadcn Combobox patterns to suggest common domains after users type `@` while suppressing conflicting browser autofill UI]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import React, { useMemo, useState } from 'react';

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from '@/components/ui/combobox';

const DEFAULT_EMAIL_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'yahoo.com',
  'qq.com',
  '163.com',
  'proton.me',
  'protonmail.com',
] as const;

type EmailDomainInputProps = Omit<React.ComponentProps<'input'>, 'onChange' | 'value'> & {
  value: string;
  onValueChange: (value: string) => void;
  domainSuggestions?: readonly string[];
};

const getSuggestionParts = (value: string) => {
  if (value.includes(' ') || value.startsWith('@')) {
    return null;
  }

  const atIndex = value.indexOf('@');
  if (atIndex < 0 || atIndex !== value.lastIndexOf('@')) {
    return null;
  }

  const localPart = value.slice(0, atIndex);
  if (!localPart) {
    return null;
  }

  return {
    localPart,
    domainPart: value.slice(atIndex + 1),
  };
};

export const EmailDomainInput: React.FC<EmailDomainInputProps> = ({
  value,
  onValueChange,
  domainSuggestions = DEFAULT_EMAIL_DOMAINS,
  autoCapitalize = 'none',
  autoComplete = 'off',
  autoCorrect = 'off',
  spellCheck = false,
  onBlur,
  onFocus,
  onKeyDown,
  disabled,
  readOnly,
  ...props
}) => {
  const suggestionsAnchor = useComboboxAnchor();
  const [isFocused, setIsFocused] = useState(false);

  const suggestions = useMemo(() => {
    const parts = getSuggestionParts(value.trim());
    if (!parts) {
      return [];
    }

    const normalizedDomainPart = parts.domainPart.toLowerCase();
    return domainSuggestions.filter((domain) => {
      const normalizedDomain = domain.toLowerCase();
      if (!normalizedDomainPart) {
        return true;
      }
      return normalizedDomain.startsWith(normalizedDomainPart) && normalizedDomain !== normalizedDomainPart;
    }).map((domain) => ({
      domain,
      value: `${parts.localPart}@${domain}`,
    }));
  }, [domainSuggestions, value]);

  const selectedSuggestionValue = suggestions.some((suggestion) => suggestion.value === value) ? value : null;
  const isOpen = isFocused && !disabled && !readOnly && suggestions.length > 0;

  return (
    <Combobox<string>
      items={suggestions.map((suggestion) => suggestion.value)}
      value={selectedSuggestionValue}
      inputValue={value}
      open={isOpen}
      autoHighlight
      onInputValueChange={(nextValue) => {
        onValueChange(nextValue);
      }}
      onValueChange={(nextValue) => {
        if (typeof nextValue === 'string') {
          onValueChange(nextValue);
        }
      }}
    >
      <div ref={suggestionsAnchor}>
        <ComboboxInput
          {...props}
          className="w-full"
          disabled={disabled}
          readOnly={readOnly}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
          spellCheck={spellCheck}
          data-1p-ignore="true"
          data-form-type="other"
          data-lpignore="true"
          showTrigger={false}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {isOpen ? (
        <ComboboxContent anchor={suggestionsAnchor} className="min-w-0">
          <ComboboxList>
            {suggestions.map((suggestion) => (
              <ComboboxItem key={suggestion.value} value={suggestion.value}>
                @{suggestion.domain}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      ) : null}
    </Combobox>
  );
};
