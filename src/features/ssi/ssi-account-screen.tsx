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
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fieldError, FormButtonRow, FormField, FormSection } from '@/components/form';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { operationFailed, operationSucceeded, warned } from '@/lib/haptics';
import { describeError, formatErrorLine } from '@/models/errors';
import { EMPTY_CREDENTIALS, validateCredentials } from '@/models/ssi/credentials';
import {
  useRefreshSsiSites,
  useSsiAccount,
  useSsiSignIn,
  useSsiSignOut,
  useSsiSiteIndexInfo,
} from '@/queries/ssi';

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export function SsiAccountScreen() {
  const theme = useTheme();
  const account = useSsiAccount();
  const signIn = useSsiSignIn();
  const signOut = useSsiSignOut();
  const siteIndex = useSsiSiteIndexInfo();
  const refreshSites = useRefreshSsiSites();

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
      'Sign out of SSI?',
      'The app forgets your SSI email, password and session. Dives already synced stay in your SSI logbook.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            signOut.mutate(undefined, {
              onSuccess: () => operationSucceeded(),
              onError: (caught) => {
                operationFailed();
                Alert.alert('Could not sign out', formatErrorLine(describeError(caught)));
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
        Alert.alert('Could not download the dive sites', formatErrorLine(describeError(caught)));
      },
    });
  };

  const info = siteIndex.data ?? { count: 0, downloadedAt: null };
  const sitesValue = refreshSites.isPending
    ? 'Downloading...'
    : info.count === 0
      ? 'Not downloaded'
      : `${info.count.toLocaleString()} sites${
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
          title="Account"
          footer="Your dives are pushed to this SSI logbook. Signing out erases the stored email, password and session from this device.">
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>Signed in as</Text>
            <Text style={[styles.rowValue, { color: theme.text }]}>{account.data.email}</Text>
          </View>
          <FormButtonRow label="Sign out" destructive onPress={confirmSignOut} />
        </FormSection>
      ) : (
        <FormSection
          title="Sign in"
          footer="Your SSI email and password are sent to SSI to obtain a session token, and are kept in this device's keychain so the app can renew that token on its own. This app is not affiliated with SSI.">
          <form.Field name="email">
            {(field) => (
              <FormField
                label="Email"
                value={field.state.value}
                onChangeText={field.handleChange}
                onBlur={field.handleBlur}
                error={fieldError(field.state.meta.errors)}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="username"
                placeholder="you@example.com"
              />
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <FormField
                label="Password"
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
                  <Text style={{ color: theme.textSecondary }}>Signing in...</Text>
                </View>
              ) : (
                <FormButtonRow label="Sign in" onPress={() => void form.handleSubmit()} />
              )
            }
          </form.Subscribe>
        </FormSection>
      )}

      <FormSection
        title="Dive sites"
        footer="SSI has no site search, so its whole site catalogue is downloaded once (about 2.5 MB) and kept on this device. Site lookup then works without a connection.">
        <FormButtonRow
          label={info.count === 0 ? 'Download dive sites' : 'Refresh dive sites'}
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
