// AI-generated (Claude)
// Importing and removing the Wallet signing certificate: pick the .p12, ask for
// its password, store it in the keychain. Used from a card when there is no
// certificate yet, and from the SSI account screen.

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Alert } from 'react-native';

import { t } from '@/i18n';
import { operationFailed, operationSucceeded, warned } from '@/lib/haptics';
import { describeError, formatErrorLine } from '@/models/errors';
import {
  useImportWalletIdentity,
  useRemoveWalletIdentity,
  useWalletIdentity,
} from '@/queries/certificates';

export function useWalletSetup() {
  const identity = useWalletIdentity();
  const importIdentity = useImportWalletIdentity();
  const removeIdentity = useRemoveWalletIdentity();

  const failed = (title: string, error: unknown) => {
    operationFailed();
    Alert.alert(title, formatErrorLine(describeError(error)));
  };

  /** Resolves true once a certificate is stored. */
  const importCertificate = (): Promise<boolean> =>
    new Promise((resolve) => {
      void (async () => {
        const picked = await DocumentPicker.getDocumentAsync({
          type: ['application/x-pkcs12', 'com.rsa.pkcs-12', '*/*'],
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (picked.canceled) {
          resolve(false);
          return;
        }
        const copy = new File(picked.assets[0].uri);
        let p12Base64: string;
        try {
          p12Base64 = copy.base64Sync();
        } catch (error) {
          failed(t('certificates.wallet.importFailed'), error);
          resolve(false);
          return;
        } finally {
          // The cache copy holds a private key; it goes as soon as it is read.
          if (copy.exists) {
            copy.delete();
          }
        }

        Alert.prompt(
          t('certificates.wallet.passwordTitle'),
          t('certificates.wallet.passwordMessage'),
          [
            { text: t('ui.cancel'), style: 'cancel', onPress: () => resolve(false) },
            {
              text: t('ui.import'),
              onPress: (password?: string) =>
                importIdentity.mutate(
                  { p12Base64, password: password ?? '' },
                  {
                    onSuccess: () => {
                      operationSucceeded();
                      resolve(true);
                    },
                    onError: (error) => {
                      failed(t('certificates.wallet.importFailed'), error);
                      resolve(false);
                    },
                  },
                ),
            },
          ],
          'secure-text',
        );
      })();
    });

  /** Explains what is needed, then imports. */
  const setUp = (): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(t('certificates.wallet.setUpTitle'), t('certificates.wallet.setUpMessage'), [
        { text: t('ui.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('certificates.wallet.choose'), onPress: () => void importCertificate().then(resolve) },
      ]);
    });

  const confirmRemove = () => {
    warned();
    Alert.alert(t('certificates.wallet.removeTitle'), t('certificates.wallet.removeMessage'), [
      { text: t('ui.cancel'), style: 'cancel' },
      {
        text: t('ui.remove'),
        style: 'destructive',
        onPress: () =>
          removeIdentity.mutate(undefined, {
            onError: (error) => failed(t('certificates.wallet.importFailed'), error),
          }),
      },
    ]);
  };

  return {
    identity: identity.data ?? null,
    importing: importIdentity.isPending,
    importCertificate,
    setUp,
    confirmRemove,
  };
}
