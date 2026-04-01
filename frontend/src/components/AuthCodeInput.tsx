// input:  [shadcn field/input-otp primitives, digit-only OTP pattern, optional browser-autofill suppression props, and controlled value/error props]
// output: [`AuthCodeInput` controlled six-digit auth-code field component]
// pos:    [Shared auth subcomponent for email-code entry across register, login, and password-reset flows with optional browser-autofill suppression]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { REGEXP_ONLY_DIGITS } from 'input-otp';

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';

type AuthCodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  description?: string;
  error?: string | null;
  disabled?: boolean;
  autoComplete?: string;
};

export const AuthCodeInput = ({
  value,
  onChange,
  label = 'Verification Code',
  description,
  error,
  disabled = false,
  autoComplete,
}: AuthCodeInputProps) => (
  <Field data-invalid={error ? true : undefined}>
    <FieldLabel className="select-none">{label}</FieldLabel>
    <InputOTP
      value={value}
      onChange={onChange}
      maxLength={6}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete={autoComplete}
      aria-invalid={error ? true : undefined}
      disabled={disabled}
      containerClassName="w-full justify-center"
      className="w-full"
      data-1p-ignore="true"
      data-form-type="other"
      data-lpignore="true"
    >
      <InputOTPGroup className="w-full">
        <InputOTPSlot index={0} className="h-11 min-w-0 flex-1 text-base" />
        <InputOTPSlot index={1} className="h-11 min-w-0 flex-1 text-base" />
        <InputOTPSlot index={2} className="h-11 min-w-0 flex-1 text-base" />
        <InputOTPSlot index={3} className="h-11 min-w-0 flex-1 text-base" />
        <InputOTPSlot index={4} className="h-11 min-w-0 flex-1 text-base" />
        <InputOTPSlot index={5} className="h-11 min-w-0 flex-1 text-base" />
      </InputOTPGroup>
    </InputOTP>
    {error ? <FieldError>{error}</FieldError> : null}
    {description ? <FieldDescription>{description}</FieldDescription> : null}
  </Field>
);
