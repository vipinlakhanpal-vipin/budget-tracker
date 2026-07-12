// Shared password rule -- at least 8 characters, containing at least one
// letter, one number, and one symbol. Shared between Login.jsx (sign-up)
// and ResetPassword.jsx (choosing a new password) so the two never drift
// out of sync with each other.
export const PASSWORD_MIN_LEN = 8;

export function passwordRuleError(pw) {
  if (pw.length < PASSWORD_MIN_LEN) return `Password must be at least ${PASSWORD_MIN_LEN} characters.`;
  if (!/[a-zA-Z]/.test(pw)) return 'Password must include at least one letter.';
  if (!/[0-9]/.test(pw)) return 'Password must include at least one number.';
  if (!/[^a-zA-Z0-9]/.test(pw)) return 'Password must include at least one symbol (e.g. ! @ # $).';
  return null;
}

export const PASSWORD_HINT = 'At least 8 characters, with a letter, a number, and a symbol (e.g. Hearth25!)';
