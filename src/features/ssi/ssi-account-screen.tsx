// AI-generated (Claude)
// The SSI account screen: sign in, sign out, and the dive-site catalogue.
//
// Plain React Native rather than @expo/ui, for the reason given at the top of
// src/components/form.tsx: a SwiftUI Form cannot host the text fields the rest
// of the editors use, and a sign-in that looked unlike every other form in the
// app would be the odd one out.
//
// The password is in a TanStack Form and never leaves this screen except into
// the keychain (src/lib/ssi/auth.ts). It is not kept in the query cache: the
// account query answers with an email address and a boolean, nothing more.

import { useForm } from '@tanstack/react-form';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fieldError, FormButtonRow, FormField, FormSection } from '@/components/form';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { operationFailed, operationSucceeded, warned } from '@/lib/haptics';
import { describeError, formatErrorLine } from '@/models/errors';
import { EMPTY_CREDENTIALS, validateCredentials } from '@/models/ssi/credentials';
import {
  useDownloadSsiLogbook,
  useRefreshSsiSites,
  useSsiAccount,
  useSsiSignIn,
  useSsiSignOut,
  useSsiSiteIndexInfo,
} from '@/queries/ssi';
import { formatInstantDate } from '@/models/date-format';
import { t } from '@/i18n';

const dateFormatter = { format: formatInstantDate };

export function SsiAccountScreen() {
  const theme = useTheme();
  const account = useSsiAccount();
  const signIn = useSsiSignIn();
  const signOut = useSsiSignOut();
  const siteIndex = useSsiSiteIndexInfo();
  const refreshSites = useRefreshSsiSites();
  const router = useRouter();
  const downloadLogbook = useDownloadSsiLogbook();

  // Sign-in failures are shown in the form rather than in an alert: the user is
  // looking at the two fields that caused it, and the fix is to retype one.
  const [signInError, setSignInError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { ...EMPTY_CREDENTIALS },
    validators: {
      // On submit rather than on change: telling someone their email is
      // incomplete while they are still typing it is scolding an empty form.
      onSubmit: ({ value }) => {
        const check = validateCredentials(value);
        return check.ok ? undefined : { fields: { [check.field]: check.message } };
      },
    },
    onSubmit: async ({ value, formApi }) => {
      setSignInError(null);
      try {
        await signIn.mutateAsync(value);
        operationSucceeded();
        // The password must not stay in the field once it is in the keychain.
        formApi.reset();
      } catch (caught) {
        operationFailed();
        setSignInError(formatErrorLine(describeError(caught)));
      }
    },
  });

  const confirmSignOut = () => {
    warned();
    Alert.alert(
      t('ssiScreen.signOutTitle'),
      t('ssiScreen.signOutMessage'),
      [
        { text: t('ui.cancel'), style: 'cancel' },
        {
          text: t('ui.signOut'),
          style: 'destructive',
          onPress: () => {
            signOut.mutate(undefined, {
              onSuccess: () => operationSucceeded(),
              onError: (caught) => {
                operationFailed();
                Alert.alert(t('ssiScreen.signOutFailed'), formatErrorLine(describeError(caught)));
              },
            });
          },
        },
      ]
    );
  };

  const downloadSites = () => {
    refreshSites.mutate(undefined, {
      onSuccess: () => operationSucceeded(),
      onError: (caught) => {
        operationFailed();
        Alert.alert(t('ssiScreen.sitesFailed'), formatErrorLine(describeError(caught)));
      },
    });
  };

  const saveFile = () => {
    downloadLogbook.mutate(undefined, {
      onSuccess: async (uri) => {
        operationSucceeded();
        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert(t('ssiScreen.saved'), uri);
          return;
        }
        await Sharing.shareAsync(uri, {
          UTI: 'org.subsurface.ssrf',
          mimeType: 'application/xml',
          dialogTitle: t('ssiScreen.saveLogbook'),
        });
      },
      onError: (caught) => {
        operationFailed();
        Alert.alert(t('ssiScreen.downloadFailed'), formatErrorLine(describeError(caught)));
      },
    });
  };

  const info = siteIndex.data ?? { count: 0, downloadedAt: null };
  const sitesValue = refreshSites.isPending
    ? t('ssiScreen.downloading')
    : info.count === 0
      ? t('settingsScreen.notDownloaded')
      : `${t('settingsScreen.siteCount', { count: info.count, formatted: info.count.toLocaleString() })}${
          info.downloadedAt === null ? '' : `, ${dateFormatter.format(info.downloadedAt)}`
        }`;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled">
      {account.data ? (
        <FormSection
          title={t('ui.account')}
          footer={t('ui.yourDivesArePushedToThis')}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{t('ssiScreen.signedInAs')}</Text>
            <Text style={[styles.rowValue, { color: theme.text }]}>{account.data.email}</Text>
          </View>
          <FormButtonRow label={t('ui.signOut')} destructive onPress={confirmSignOut} />
        </FormSection>
      ) : (
        <FormSection
          title={t('ui.signIn')}
          footer={t('ui.yourSsiEmailAndPasswordAre')}>
          <form.Field name="email">
            {(field) => (
              <FormField
                label={t('ui.email')}
                value={field.state.value}
                onChangeText={field.handleChange}
                onBlur={field.handleBlur}
                error={fieldError(field.state.meta.errors)}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="username"
                placeholder={t('ui.youExampleCom')}
              />
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <FormField
                label={t('ui.password')}
                value={field.state.value}
                onChangeText={field.handleChange}
                onBlur={field.handleBlur}
                error={fieldError(field.state.meta.errors)}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                onSubmitEditing={() => void form.handleSubmit()}
              />
            )}
          </form.Field>

          {signInError ? (
            <Text style={[styles.error, { color: theme.danger }]}>{signInError}</Text>
          ) : null}

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) =>
              isSubmitting ? (
                <View style={styles.pending}>
                  <ActivityIndicator />
                  <Text style={{ color: theme.textSecondary }}>{t('ssiScreen.signingIn')}</Text>
                </View>
              ) : (
                <FormButtonRow label={t('ui.signIn')} onPress={() => void form.handleSubmit()} />
              )
            }
          </form.Subscribe>
        </FormSection>
      )}

      {account.data ? (
        <>
          <FormSection
            title={t('ui.logbook')}
            footer={t('ui.chooseDivesToAddOrReplace')}>
            <FormButtonRow
              label={t('ui.addSsiDivesToThisLogbook')}
              onPress={() => router.push('/settings/ssi-import')}
            />
          </FormSection>
          <FormSection footer={t('ui.aSeparateFileWithYourWhole')}>
            <FormButtonRow
              label={t('ui.saveSsiLogbookAsAFile')}
              value={downloadLogbook.isPending ? t('ssiScreen.downloading') : undefined}
              onPress={downloadLogbook.isPending ? () => undefined : saveFile}
            />
          </FormSection>
        </>
      ) : null}

      <FormSection
        title={t('ui.diveSites')}
        footer={t('ui.ssiHasNoSiteSearchSo')}>
        <FormButtonRow
          label={info.count === 0 ? t('ssiScreen.downloadSites') : t('ssiScreen.refreshSites')}
          value={sitesValue}
          onPress={downloadSites}
        />
      </FormSection>
    </ScrollView>
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
  error: {
    fontSize: 15,
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
