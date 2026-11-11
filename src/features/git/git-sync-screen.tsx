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
import { formatInstant } from '@/models/date-format';
import { t } from '@/i18n';

const dateFormatter = { format: (date: Date | number) => formatInstant(Number(date)) };

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
      t('gitScreen.switchTitle'),
      t('gitScreen.switchMessage'),
      [
        { text: t('ui.cancel'), style: 'cancel' },
        { text: t('ui.switch'), onPress: () => void form.handleSubmit() },
      ],
    );
  };

  const generate = () => {
    const run = () =>
      generateKey.mutate(undefined, {
        onSuccess: () => operationSucceeded(),
        onError: (error) => failed(t('gitScreen.generateFailed'), error),
      });
    if (key.data == null) {
      run();
      return;
    }
    warned();
    Alert.alert(
      t('gitScreen.replaceTitle'),
      t('gitScreen.replaceMessage'),
      [
        { text: t('ui.cancel'), style: 'cancel' },
        { text: t('ui.replace'), style: 'destructive', onPress: run },
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
        failed(t('gitScreen.readFailed'), error);
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
        failed(t('gitScreen.notPrivate'), error);
        return;
      }

      const store = (passphrase?: string) =>
        importKey.mutate(
          { text, passphrase },
          {
            onSuccess: () => operationSucceeded(),
            onError: (error) => failed(t('gitScreen.importFailed'), error),
          },
        );
      if (!encrypted) {
        store();
        return;
      }
      Alert.prompt(
        t('gitScreen.passphrase'),
        t('gitScreen.passphraseMessage'),
        [
          { text: t('ui.cancel'), style: 'cancel' },
          { text: t('ui.import'), onPress: (value?: string) => store(value ?? '') },
        ],
        'secure-text',
      );
    })();
  };

  const confirmDeleteKey = () => {
    warned();
    Alert.alert(t('gitScreen.removeTitle'), t('gitScreen.removeMessage'), [
      { text: t('ui.cancel'), style: 'cancel' },
      {
        text: t('ui.remove'),
        style: 'destructive',
        onPress: () =>
          deleteKey.mutate(undefined, {
            onError: (error) => failed(t('gitScreen.removeFailed'), error),
          }),
      },
    ]);
  };

  const sharePublicKey = (publicKey: string) => {
    void Share.share({ message: publicKey });
  };

  const confirmForgetHost = (host: string) => {
    warned();
    Alert.alert(t('gitScreen.forgetTitle', { host }), t('gitScreen.forgetMessage'), [
      { text: t('ui.cancel'), style: 'cancel' },
      { text: t('ui.forget'), style: 'destructive', onPress: () => forgetHost.mutate(host) },
    ]);
  };

  const confirmDisconnect = () => {
    warned();
    Alert.alert(
      t('gitScreen.offTitle'),
      t('gitScreen.offMessage'),
      [
        { text: t('ui.cancel'), style: 'cancel' },
        {
          text: t('ui.turnOff'),
          style: 'destructive',
          onPress: () =>
            disconnect.mutate(undefined, {
              onSuccess: () => form.reset({ ...form.state.values, url: '' }),
              onError: (error) => failed(t('gitScreen.offFailed'), error),
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
        title={t('ui.sync')}
        footer={t('ui.syncCommitsTheLogbookBringsIn')}
      >
        {configured ? (
          <>
            <Row
              label={t('ui.lastSync')}
              value={config.lastSyncAt === null ? t('gitScreen.never') : dateFormatter.format(config.lastSyncAt)}
            />
            <Row
              label={t('ui.commit')}
              value={
                status.data
                  ? describeHead(status.data.head, (date) => dateFormatter.format(date))
                  : '...'
              }
            />
            <Row label={t('ui.server')} value={status.data ? describeServerState(status.data) : '...'} />
            {runner.busy ? (
              <View style={styles.pending}>
                <ActivityIndicator />
                <Text style={{ color: theme.textSecondary }}>{t('gitScreen.syncing')}</Text>
              </View>
            ) : (
              <>
                <FormButtonRow label={t('ui.commitAndPush')} onPress={() => runner.run('sync')} />
                <FormButtonRow label={t('ui.pull')} onPress={() => runner.run('pull')} />
              </>
            )}
          </>
        ) : (
          <Text style={[styles.note, { color: theme.textSecondary }]}>
            {t('gitScreen.notConfigured')}
          </Text>
        )}
      </FormSection>

      <FormSection
        title={t('ui.repository')}
        footer={t('ui.anSshUrlSuchAsGit')}
      >
        <form.Field name="url">
          {(field) => (
            <FormField
              label={t('ui.url')}
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
              label={t('ui.branch')}
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
              label={t('ui.fileInTheRepository')}
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
              label={t('ui.commitAuthor')}
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
              label={t('ui.authorEmail')}
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
        <FormButtonRow label={t('ui.save')} onPress={confirmSave} />
      </FormSection>

      <FormSection
        title={t('ui.sshKey')}
        footer={t('ui.thePrivateKeyStaysInThis')}
      >
        {key.data ? (
          <>
            {key.data.publicKey ? (
              <Text selectable style={[styles.key, { color: theme.text }]}>
                {key.data.publicKey}
              </Text>
            ) : (
              <Text style={[styles.note, { color: theme.textSecondary }]}>
                {t('gitScreen.importedKey')}
              </Text>
            )}
            {key.data.publicKey ? (
              <FormButtonRow
                label={t('ui.sharePublicKey')}
                onPress={() => sharePublicKey(key.data!.publicKey!)}
              />
            ) : null}
            <FormButtonRow label={t('ui.generateANewKey')} onPress={generate} />
            <FormButtonRow label={t('ui.importAPrivateKey')} onPress={pickKey} />
            <FormButtonRow label={t('ui.removeKey')} destructive onPress={confirmDeleteKey} />
          </>
        ) : (
          <>
            <FormButtonRow label={t('ui.generateANewKey')} onPress={generate} />
            <FormButtonRow label={t('ui.importAPrivateKey')} onPress={pickKey} />
          </>
        )}
      </FormSection>

      {hosts.length > 0 ? (
        <FormSection
          title={t('ui.trustedServers')}
          footer={t('ui.hostKeysTrustedOnFirstConnection')}
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
          <FormButtonRow label={t('ui.turnOffGitSync')} destructive onPress={confirmDisconnect} />
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
