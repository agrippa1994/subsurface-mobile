// AI-generated (Claude)
// Running a sync from a screen: the alerts around it.
//
// A sync can stop for a reason only the user can resolve - a server whose host
// key nobody has vouched for yet, or one whose key changed - so it is run
// through here, which asks, remembers the answer and runs it again. Both the
// git sync screen and the Settings row use it.

import { useCallback } from 'react';
import { Alert } from 'react-native';

import { GitSyncError } from '../../../modules/git-sync/src';
import { operationFailed, operationSucceeded, warned } from '@/lib/haptics';
import type { SyncMode } from '@/lib/git/sync';
import { describeSyncError, describeSyncResult } from '@/models/git/presentation';
import { useGitSync, useTrustHostKey } from '@/queries/git-sync';
import { t } from '@/i18n';

export type GitSyncRunner = {
  run: (mode: SyncMode) => void;
  busy: boolean;
};

export function useGitSyncRunner(): GitSyncRunner {
  const sync = useGitSync();
  const trust = useTrustHostKey();

  const run = useCallback(
    (mode: SyncMode) => {
      // Trusting a host key runs the same sync again, which is why this is a
      // function of its own rather than the callback body.
      const attempt = () =>
        sync.mutate(mode, {
          onSuccess: (result) => {
            operationSucceeded();
            Alert.alert(mode === 'pull' ? t('gitScreen.pulled') : t('gitScreen.synced'), describeSyncResult(result));
          },
          onError: (error) => {
            if (
              error instanceof GitSyncError &&
              error.code === 'unknown-host-key' &&
              error.fingerprint
            ) {
              const fingerprint = error.fingerprint;
              warned();
              Alert.alert(
                error.host ? t('gitScreen.trustTitle', { host: error.host }) : t('gitScreen.trustServer'),
                t('gitScreen.trustMessage', { fingerprint }),
                [
                  { text: t('ui.cancel'), style: 'cancel' },
                  { text: t('gitScreen.trust'), onPress: () => retryTrusting(fingerprint) },
                ],
              );
              return;
            }
            if (
              error instanceof GitSyncError &&
              error.code === 'host-key-mismatch' &&
              error.fingerprint
            ) {
              const fingerprint = error.fingerprint;
              operationFailed();
              Alert.alert(
                t('gitScreen.changedTitle'),
                t('gitScreen.changedMessage', { host: error.host ?? '', fingerprint }),
                [
                  { text: t('ui.cancel'), style: 'cancel' },
                  {
                    text: t('gitScreen.trustNew'),
                    style: 'destructive',
                    onPress: () => retryTrusting(fingerprint),
                  },
                ],
              );
              return;
            }
            operationFailed();
            const info = describeSyncError({
              code: error instanceof GitSyncError ? error.code : undefined,
              message: error.message,
            });
            Alert.alert(info.title, info.message);
          },
        });
      const retryTrusting = (fingerprint: string) => {
        trust.mutate(fingerprint, { onSuccess: attempt });
      };
      attempt();
    },
    [sync, trust],
  );

  return { run, busy: sync.isPending || trust.isPending };
}
