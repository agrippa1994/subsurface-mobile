// AI-generated (Claude)
// What a form shows for a field's errors, on every platform.

/**
 * A form field's error as one line. TanStack Form collects errors into an
 * array and lets a validator return a string or an object; a field shows a
 * single line, so this takes the first thing that is actually an error.
 */
export function fieldError(errors: readonly unknown[]): string | undefined {
  const first = errors.find((error) => error !== undefined && error !== null);
  if (first === undefined) {
    return undefined;
  }
  if (typeof first === 'string') {
    return first;
  }
  const message = (first as { message?: unknown }).message;
  return typeof message === 'string' ? message : String(first);
}
