// AI-generated (Claude)
// Wording for the git sync: what a sync did, why it failed, where things stand.

import type { SyncResult } from '@/lib/git/sync';
import { shortId } from './sync-plan';
import { t } from '@/i18n';

export function describeSyncResult(result: SyncResult): string {
  switch (result.outcome) {
    case 'up-to-date':
      return t('git.result.upToDate');
    case 'sent':
      return result.pushed ? t('git.result.sentPushed') : t('git.result.sent');
    case 'received':
      return result.logbookChanged ? t('git.result.received') : t('git.result.upToDate');
    case 'merged':
      return result.pushed ? t('git.result.mergedPushed') : t('git.result.merged');
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
        title: t('git.error.authTitle'),
        message: t('git.error.authMessage'),
      };
    case 'push-rejected':
      return {
        title: t('git.error.pushTitle'),
        message: t('git.error.pushMessage'),
      };
    default:
      // libssh2's wording when it cannot decrypt the key: a wrong passphrase
      // is far likelier than an actually unsupported file.
      if (/extract public key from private key/i.test(error.message)) {
        return {
          title: t('git.error.keyTitle'),
          message: t('git.error.keyMessage'),
        };
      }
      return { title: t('git.error.failed'), message: error.message };
  }
}

/** "a1b2c3d, 2 Oct 2026" - the commit the device is on. */
export function describeHead(
  head: { id: string; time: number } | null,
  format: (date: Date) => string,
): string {
  return head === null
    ? t('git.head.none')
    : `${shortId(head.id)}, ${format(new Date(head.time * 1000))}`;
}

/** Where this device stands against the server, as of the last sync. */
export function describeServerState(state: {
  ahead: number;
  behind: number;
  neverPushed: boolean;
}): string {
  if (state.neverPushed) {
    return t('git.server.neverPushed');
  }
  const parts: string[] = [];
  if (state.ahead > 0) {
    parts.push(t('git.server.ahead', { count: state.ahead }));
  }
  if (state.behind > 0) {
    parts.push(t('git.server.behind', { count: state.behind }));
  }
  return parts.length === 0 ? t('git.server.inSync') : parts.join(', ');
}
