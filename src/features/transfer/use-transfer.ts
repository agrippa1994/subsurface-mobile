// AI-generated (Claude)
// Import and export as the screens see them: pick a file, merge or open it,
// share the logbook. Everything file-format is the native module's business
// (see modules/ssrf-core/src/index.ts) and everything wording is
// src/models/transfer.ts; what is left here is the OS plumbing.

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { operationFailed, operationSucceeded, warned } from '@/lib/haptics';
import { toNativePath } from '@/lib/logbook-file';
import { copyContentUri } from '../../../modules/ssrf-core/src';
import { describeError } from '@/models/errors';
import {
  IMPORT_DOCUMENT_TYPES,
  describeImport,
  exportFileName,
  importNeedsExplaining,
  isLogbookName,
} from '@/models/transfer';
import { useExportTo, useImportFile, useReplaceLogbook } from '@/queries/logbook-mutations';
import { t } from '@/i18n';

/** Alert body for a failure: the message, plus whatever the core reported. */
function describeFailure(error: unknown): string {
  const info = describeError(error);
  return [info.message, ...info.details].join('\n\n');
}

export type Transfer = {
  /** True while a picked file is being read, so a screen can disable its rows. */
  busy: boolean;
  /** Picks a file and merges it into the logbook. */
  importFile: () => void;
  /** Picks a logbook and opens it in place of the current one, after confirming. */
  openLogbook: () => void;
  /** Writes the logbook to a temp file and hands it to the share sheet. */
  shareLogbook: () => void;
  /**
   * Handles a file the OS gave the app ("Open in...", AirDrop, a tapped
   * attachment): asks what to do with it, then merges or opens it.
   */
  handleIncoming: (uri: string) => Promise<void>;
};

export function useTransfer(): Transfer {
  // Sharing is the one path with no mutation of its own to report progress, so
  // it keeps a flag; the rest read `isPending` off their mutation.
  const [sharing, setSharing] = useState(false);
  const importIntoLog = useImportFile();
  const replaceWith = useReplaceLogbook();
  const exportTo = useExportTo();
  const busy = sharing || importIntoLog.isPending || replaceWith.isPending || exportTo.isPending;

  const merge = useCallback(
    async (path: string) => {
      try {
        const result = await importIntoLog.mutateAsync(path);
        operationSucceeded();
        // A plain import is the toast's to report, with its Undo. Anything more
        // needs reading.
        if (importNeedsExplaining(result)) {
          Alert.alert(t('transferScreen.importComplete'), describeImport(result));
        }
      } catch (error) {
        operationFailed();
        Alert.alert(t('transferScreen.importFailed'), describeFailure(error));
      }
    },
    [importIntoLog],
  );

  const replace = useCallback(
    async (path: string) => {
      try {
        const { lastLoad } = await replaceWith.mutateAsync(path);
        operationSucceeded();
        Alert.alert(
          t('transferScreen.opened'),
          t('transferScreen.openedMessage', {
            dives: t('common.diveCount', { count: lastLoad.dives }),
            sites: t('transferScreen.siteCount', { count: lastLoad.sites }),
          }),
        );
      } catch (error) {
        operationFailed();
        Alert.alert(t('transferScreen.openFailed'), describeFailure(error));
      }
    },
    [replaceWith],
  );

  const pick = useCallback(async (): Promise<string | null> => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: IMPORT_DOCUMENT_TYPES,
      // The picked file may live in another app's container or in iCloud, where
      // it can go away or be unreadable; a local copy is what gets parsed.
      copyToCacheDirectory: true,
      multiple: false,
    });
    return picked.canceled ? null : toNativePath(picked.assets[0].uri);
  }, []);

  const importFile = useCallback(() => {
    void pick().then((path) => (path === null ? undefined : merge(path)));
  }, [merge, pick]);

  const openLogbook = useCallback(() => {
    void pick().then((path) => {
      if (path === null) {
        return;
      }
      // Opening throws the current logbook away, and is the one thing here that
      // does not undo - so it asks first, every time.
      warned();
      Alert.alert(
        t('transferScreen.openTitle'),
        t('transferScreen.openMessage'),
        [
          { text: t('ui.cancel'), style: 'cancel' },
          { text: t('ui.import'), onPress: () => void merge(path) },
          { text: t('transferScreen.open'), style: 'destructive', onPress: () => void replace(path) },
        ],
      );
    });
  }, [merge, pick, replace]);

  const shareLogbook = useCallback(() => {
    void (async () => {
      setSharing(true);
      try {
        // Exported under a dated name rather than "logbook.ssrf": the name is
        // what the receiving app shows, and it is the copy being shared, not
        // the working file.
        const target = new File(Paths.cache, exportFileName());
        if (target.exists) {
          target.delete();
        }
        await exportTo.mutateAsync(toNativePath(target.uri));
        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert(t('transferScreen.exportSaved'), target.uri);
          return;
        }
        await Sharing.shareAsync(target.uri, {
          UTI: 'org.subsurface.ssrf',
          mimeType: 'application/xml',
          dialogTitle: t('transferScreen.share'),
        });
      } catch (error) {
        operationFailed();
        Alert.alert(t('transferScreen.exportFailed'), describeFailure(error));
      } finally {
        setSharing(false);
      }
    })();
  }, [exportTo]);

  const handleIncoming = useCallback(
    async (incoming: string) => {
      // Android hands over a content:// URL, which the core cannot fopen().
      // The file is copied into the cache under the name the sender gave it -
      // the name is what tells a logbook from a dive export below.
      let uri = incoming;
      if (incoming.startsWith('content://')) {
        try {
          uri = `file://${encodeURI(await copyContentUri(incoming))}`;
        } catch (error) {
          operationFailed();
          Alert.alert(t('transferScreen.openFailed'), describeFailure(error));
          return;
        }
      }
      const path = toNativePath(uri);
      const name = path.slice(path.lastIndexOf('/') + 1);
      // iOS drops the file into Documents/Inbox and never cleans up after
      // itself, so whatever it left there goes once it has been read; the
      // Android cache copy likewise.
      const done = async (work: Promise<void>) => {
        await work;
        const inbox = new File(uri);
        if ((path.includes('/Documents/Inbox/') || uri !== incoming) && inbox.exists) {
          inbox.delete();
        }
      };

      // A single-dive export can only be merged; for a whole logbook both
      // answers are reasonable, so the user picks.
      if (!isLogbookName(name)) {
        await done(merge(path));
        return;
      }
      Alert.alert(name, t('transferScreen.incoming'), [
        { text: t('ui.cancel'), style: 'cancel' },
        { text: t('transferScreen.open'), style: 'destructive', onPress: () => void done(replace(path)) },
        { text: t('ui.import'), onPress: () => void done(merge(path)) },
      ]);
    },
    [merge, replace],
  );

  return { busy, importFile, openLogbook, shareLogbook, handleIncoming };
}
