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
            Alert.alert(mode === 'pull' ? 'Pulled' : 'Synced', describeSyncResult(result));
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
                `Trust ${error.host ?? 'this server'}?`,
                `This is the first connection to the server. Its host key fingerprint is:\n\n${fingerprint}\n\nCompare it with the one your git host publishes before trusting it.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Trust', onPress: () => retryTrusting(fingerprint) },
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
                'Host key changed',
                `The server ${error.host ?? ''} presented a different host key than the one trusted before:\n\n${fingerprint}\n\nThis happens when the host replaces its keys, but it is also what an attacker in the middle looks like. Only trust the new key if your git host announced the change.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Trust new key',
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
