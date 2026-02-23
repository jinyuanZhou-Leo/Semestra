// input:  [password text from login/register forms]
// output: [`getPasswordRuleError()` validator and `passwordRuleHint` copy constant]
// pos:    [Shared password policy helper used by auth pages]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

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
