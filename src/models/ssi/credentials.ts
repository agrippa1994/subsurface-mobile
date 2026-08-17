// AI-generated (Claude)
// The SSI sign-in form's shape and its validation.
//
// Kept apart from the screen for the same reason as models/site-edit.ts: the
// rules stay covered by the Node test suite. The credentials themselves are
// never written here - only the keychain in src/lib/ssi/auth.ts holds them.

export type SsiCredentials = {
  email: string;
  password: string;
};

export const EMPTY_CREDENTIALS: SsiCredentials = { email: '', password: '' };

export type CredentialsCheck = { ok: true } | { ok: false; field: 'email' | 'password'; message: string };

/**
 * Deliberately loose: anything with an @ between two non-empty runs is worth
 * sending. SSI decides what a real account is, and a stricter pattern here
 * would only reject addresses that work.
 */
function looksLikeEmail(value: string): boolean {
  const at = value.indexOf('@');
  return at > 0 && at < value.length - 1 && !value.includes(' ');
}

export function validateCredentials(credentials: SsiCredentials): CredentialsCheck {
  const email = credentials.email.trim();

  if (email === '') {
    return { ok: false, field: 'email', message: 'Enter the email address of your SSI account.' };
  }
  if (!looksLikeEmail(email)) {
    return { ok: false, field: 'email', message: 'That does not look like an email address.' };
  }
  // Not trimmed: a password may legitimately begin or end with a space, and
  // silently changing one would produce a sign-in failure with no explanation.
  if (credentials.password === '') {
    return { ok: false, field: 'password', message: 'Enter your SSI password.' };
  }

  return { ok: true };
}

/** What gets sent and stored: the address normalised, the password untouched. */
export function normalizeCredentials(credentials: SsiCredentials): SsiCredentials {
  return { email: credentials.email.trim(), password: credentials.password };
}
