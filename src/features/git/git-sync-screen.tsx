// AI-generated (Claude)
// The git sync screen: the repository, the SSH key, and the sync itself.
//
// Plain React Native, like the SSI account screen and for the same reason
// (src/components/form.tsx): it is mostly text fields.

import { useForm } from '@tanstack/react-form';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { fieldError, FormButtonRow, FormField, FormSection } from '@/components/form';
import { Spacing } from '@/constants/theme';
import { useGitSyncRunner } from '@/features/git/use-git-sync-runner';
import { useTheme } from '@/hooks/use-theme';
import { operationFailed, operationSucceeded, warned } from '@/lib/haptics';
import { describeError, formatErrorLine } from '@/models/errors';
import { describeHead, describeServerState } from '@/models/git/presentation';
import { describePrivateKey } from '@/models/git/ssh-key';
import { validateRemoteUrl } from '@/models/git/remote-url';
import { validateRepositorySettings, type RepositorySettings } from '@/models/git/sync-config';
import {
  useDeleteKey,
  useDisconnectSync,
  useForgetHostKey,
  useGenerateKey,
  useGitKey,
  useGitStatus,
  useGitSyncConfig,
  useImportKey,
  useSaveRepositorySettings,
} from '@/queries/git-sync';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function failed(title: string, error: unknown) {
  operationFailed();
  Alert.alert(title, formatErrorLine(describeError(error)));
}

export function GitSyncScreen() {
  const theme = useTheme();
  const config = useGitSyncConfig();
  const key = useGitKey();
  const configured = config.url !== '';
  const status = useGitStatus(configured);
  const runner = useGitSyncRunner();

  const saveSettings = useSaveRepositorySettings();
  const generateKey = useGenerateKey();
  const importKey = useImportKey();
  const deleteKey = useDeleteKey();
  const forgetHost = useForgetHostKey();
  const disconnect = useDisconnectSync();

  const [saveError, setSaveError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      url: config.url,
      branch: config.branch,
      pathInRepo: config.pathInRepo,
      authorName: config.authorName,
      authorEmail: config.authorEmail,
    } satisfies RepositorySettings,
    validators: {
      onSubmit: ({ value }) => {
        const urlProblem = validateRemoteUrl(value.url);
        if (urlProblem !== null) {
          return { fields: { url: urlProblem } };
        }
        const check = validateRepositorySettings(value);
        return check === null ? undefined : { fields: { [check.field]: check.message } };
      },
    },
    onSubmit: async ({ value }) => {
      setSaveError(null);
      try {
        await saveSettings.mutateAsync(value);
        operationSucceeded();
      } catch (caught) {
        operationFailed();
        setSaveError(formatErrorLine(describeError(caught)));
      }
    },
  });

  const confirmSave = () => {
    const value = form.state.values;
    const movesHistory =
      configured && (value.url.trim() !== config.url || value.branch.trim() !== config.branch);
    if (!movesHistory) {
      void form.handleSubmit();
      return;
    }
    warned();
    Alert.alert(
      'Switch repository?',
      'The sync starts over with the new repository or branch. The logbook on this device stays as it is and is merged with what the new one holds on the next sync.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Switch', onPress: () => void form.handleSubmit() },
      ],
    );
  };

  const generate = () => {
    const run = () =>
      generateKey.mutate(undefined, {
        onSuccess: () => operationSucceeded(),
        onError: (error) => failed('Could not generate a key', error),
      });
    if (key.data == null) {
      run();
      return;
    }
    warned();
    Alert.alert(
      'Replace the key?',
      'The current key is deleted from this device. Remove it from your git host as well.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: run },
      ],
    );
  };

  const pickKey = () => {
    void (async () => {
      const picked = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) {
        return;
      }
      const copy = new File(picked.assets[0].uri);
      let text: string;
      try {
        text = copy.textSync();
      } catch (error) {
        failed('Could not read the file', error);
        return;
      } finally {
        // The cache copy is a private key in plain text; it goes as soon as it
        // has been read, whatever happens next.
        if (copy.exists) {
          copy.delete();
        }
      }

      let encrypted: boolean;
      try {
        encrypted = describePrivateKey(text).encrypted;
      } catch (error) {
        failed('Not a private key', error);
        return;
      }

      const store = (passphrase?: string) =>
        importKey.mutate(
          { text, passphrase },
          {
            onSuccess: () => operationSucceeded(),
            onError: (error) => failed('Could not import the key', error),
          },
        );
      if (!encrypted) {
        store();
        return;
      }
      Alert.prompt(
        'Passphrase',
        'This key is protected by a passphrase. It is kept in the keychain with the key.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Import', onPress: (value?: string) => store(value ?? '') },
        ],
        'secure-text',
      );
    })();
  };

  const confirmDeleteKey = () => {
    warned();
    Alert.alert('Remove the key?', 'Sync stops working until a new key is added.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          deleteKey.mutate(undefined, {
            onError: (error) => failed('Could not remove the key', error),
          }),
      },
    ]);
  };

  const sharePublicKey = (publicKey: string) => {
    void Share.share({ message: publicKey });
  };

  const confirmForgetHost = (host: string) => {
    warned();
    Alert.alert(`Forget ${host}?`, 'The next sync asks again whether to trust its host key.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Forget', style: 'destructive', onPress: () => forgetHost.mutate(host) },
    ]);
  };

  const confirmDisconnect = () => {
    warned();
    Alert.alert(
      'Turn off git sync?',
      'The repository URL and the sync history on this device are removed. The logbook, the server and the key are untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: () =>
            disconnect.mutate(undefined, {
              onSuccess: () => form.reset({ ...form.state.values, url: '' }),
              onError: (error) => failed('Could not turn off sync', error),
            }),
        },
      ],
    );
  };

  const hosts = Object.entries(config.knownHosts);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <FormSection
        title="Sync"
        footer="Sync commits the logbook, brings in what changed on the server and pushes the result. Pull only brings changes in. When both sides changed, the server's logbook is merged into this one the way an import is: new dives are added, matching dives combined - a dive deleted on one side and kept on the other comes back."
      >
        {configured ? (
          <>
            <Row
              label="Last sync"
              value={config.lastSyncAt === null ? 'Never' : dateFormatter.format(config.lastSyncAt)}
            />
            <Row
              label="Commit"
              value={
                status.data
                  ? describeHead(status.data.head, (date) => dateFormatter.format(date))
                  : '...'
              }
            />
            <Row label="Server" value={status.data ? describeServerState(status.data) : '...'} />
            {runner.busy ? (
              <View style={styles.pending}>
                <ActivityIndicator />
                <Text style={{ color: theme.textSecondary }}>Syncing...</Text>
              </View>
            ) : (
              <>
                <FormButtonRow label="Commit and push" onPress={() => runner.run('sync')} />
                <FormButtonRow label="Pull" onPress={() => runner.run('pull')} />
              </>
            )}
          </>
        ) : (
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            Set up a repository and a key below to sync this logbook with git.
          </Text>
        )}
      </FormSection>

      <FormSection
        title="Repository"
        footer="An SSH URL, such as git@github.com:you/logbook.git. The repository may be empty; the logbook is committed as the file named here, and any other files in it are left alone."
      >
        <form.Field name="url">
          {(field) => (
            <FormField
              label="URL"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              error={fieldError(field.state.meta.errors)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="git@github.com:you/logbook.git"
            />
          )}
        </form.Field>
        <form.Field name="branch">
          {(field) => (
            <FormField
              label="Branch"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              error={fieldError(field.state.meta.errors)}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
        </form.Field>
        <form.Field name="pathInRepo">
          {(field) => (
            <FormField
              label="File in the repository"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              error={fieldError(field.state.meta.errors)}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
        </form.Field>
        <form.Field name="authorName">
          {(field) => (
            <FormField
              label="Commit author"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              error={fieldError(field.state.meta.errors)}
            />
          )}
        </form.Field>
        <form.Field name="authorEmail">
          {(field) => (
            <FormField
              label="Author email"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              error={fieldError(field.state.meta.errors)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          )}
        </form.Field>
        {saveError ? <Text style={[styles.note, { color: theme.danger }]}>{saveError}</Text> : null}
        <FormButtonRow label="Save" onPress={confirmSave} />
      </FormSection>

      <FormSection
        title="SSH key"
        footer="The private key stays in this device's keychain. Add the public key to your git host - as a deploy key with write access to the logbook repository, or to your account."
      >
        {key.data ? (
          <>
            {key.data.publicKey ? (
              <Text selectable style={[styles.key, { color: theme.text }]}>
                {key.data.publicKey}
              </Text>
            ) : (
              <Text style={[styles.note, { color: theme.textSecondary }]}>
                Imported key. Its public half is not in the file; use the .pub file that came with
                it.
              </Text>
            )}
            {key.data.publicKey ? (
              <FormButtonRow
                label="Share public key"
                onPress={() => sharePublicKey(key.data!.publicKey!)}
              />
            ) : null}
            <FormButtonRow label="Generate a new key" onPress={generate} />
            <FormButtonRow label="Import a private key" onPress={pickKey} />
            <FormButtonRow label="Remove key" destructive onPress={confirmDeleteKey} />
          </>
        ) : (
          <>
            <FormButtonRow label="Generate a new key" onPress={generate} />
            <FormButtonRow label="Import a private key" onPress={pickKey} />
          </>
        )}
      </FormSection>

      {hosts.length > 0 ? (
        <FormSection
          title="Trusted servers"
          footer="Host keys trusted on first connection. Tap one to forget it."
        >
          {hosts.map(([host, fingerprint]) => (
            <FormButtonRow
              key={host}
              label={host}
              value={fingerprint}
              onPress={() => confirmForgetHost(host)}
            />
          ))}
        </FormSection>
      ) : null}

      {configured ? (
        <FormSection>
          <FormButtonRow label="Turn off git sync" destructive onPress={confirmDisconnect} />
        </FormSection>
      ) : null}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowLabel: {
    fontSize: 15,
  },
  rowValue: {
    flexShrink: 1,
    fontSize: 15,
    textAlign: 'right',
  },
  note: {
    fontSize: 15,
  },
  key: {
    fontSize: 13,
    fontFamily: 'Menlo',
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
