// AI-generated (Claude)
// Wording for the git sync: what a sync did, why it failed, where things stand.

import type { SyncResult } from '@/lib/git/sync';
import { shortId } from './sync-plan';

export function describeSyncResult(result: SyncResult): string {
  const pushed = result.pushed ? ' and pushed' : '';
  switch (result.outcome) {
    case 'up-to-date':
      return 'The logbook is up to date.';
    case 'sent':
      return result.pushed
        ? 'Your changes were committed and pushed.'
        : 'Your changes were committed. They reach the server with the next push.';
    case 'received':
      return result.logbookChanged
        ? 'The logbook was updated with the changes from the server.'
        : 'The logbook is up to date.';
    case 'merged':
      return `The changes from the server were merged with yours${pushed}.`;
  }
}

/** The few error codes a person can act on, as a title and an explanation. */
export function describeSyncError(error: { code?: string; message: string }): {
  title: string;
  message: string;
} {
  switch (error.code) {
    case 'auth-failed':
      return {
        title: 'The server refused the key',
        message:
          'Add the public key to the repository host (as a deploy key with write access, or to your account), or check the passphrase of an imported key.',
      };
    case 'push-rejected':
      return {
        title: 'The server refused the push',
        message:
          'The repository changed while syncing, or the branch is protected. Sync again to bring in its changes first.',
      };
    default:
      // libssh2's wording when it cannot decrypt the key: a wrong passphrase
      // is far likelier than an actually unsupported file.
      if (/extract public key from private key/i.test(error.message)) {
        return {
          title: 'The SSH key could not be used',
          message: 'The passphrase is wrong, or the key file is damaged. Import the key again.',
        };
      }
      return { title: 'Sync failed', message: error.message };
  }
}

/** "a1b2c3d, 2 Oct 2026" - the commit the device is on. */
export function describeHead(
  head: { id: string; time: number } | null,
  format: (date: Date) => string,
): string {
  return head === null
    ? 'No commits yet'
    : `${shortId(head.id)}, ${format(new Date(head.time * 1000))}`;
}

/** Where this device stands against the server, as of the last sync. */
export function describeServerState(state: {
  ahead: number;
  behind: number;
  neverPushed: boolean;
}): string {
  if (state.neverPushed) {
    return 'Not pushed yet';
  }
  const parts: string[] = [];
  if (state.ahead > 0) {
    parts.push(`${state.ahead} to push`);
  }
  if (state.behind > 0) {
    parts.push(`${state.behind} to pull`);
  }
  return parts.length === 0 ? 'In sync' : parts.join(', ');
}
