export const getPasswordRuleError = (password: string): string | null => {
    if (password.length <= 8) {
        return 'Password must be longer than 8 characters.';
    }

    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);

    if (!hasLowercase || !hasUppercase) {
        return 'Password must include both uppercase and lowercase letters.';
    }

    return null;
};

export const passwordRuleHint = 'Use at least 9 characters with both uppercase and lowercase letters.';
