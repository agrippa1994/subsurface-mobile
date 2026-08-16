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
import { describeError } from '@/models/errors';
import {
  IMPORT_DOCUMENT_TYPES,
  describeImport,
  exportFileName,
  isLogbookName,
} from '@/models/transfer';
import { useExportTo, useImportFile, useReplaceLogbook } from '@/queries/logbook-mutations';

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
        Alert.alert('Import complete', describeImport(result));
      } catch (error) {
        operationFailed();
        Alert.alert('Import failed', describeFailure(error));
      }
    },
    [importIntoLog],
  );

  const replace = useCallback(
    async (path: string) => {
      try {
        const { lastLoad } = await replaceWith.mutateAsync(path);
        operationSucceeded();
        Alert.alert('Logbook opened', `${lastLoad.dives} dives, ${lastLoad.sites} dive sites.`);
      } catch (error) {
        operationFailed();
        Alert.alert('Could not open', describeFailure(error));
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
      // Opening throws the current logbook away, which is the one destructive
      // thing in this file - so it asks first, every time.
      warned();
      Alert.alert(
        'Open this logbook?',
        'The dives currently in the app are replaced by the ones in the file. Import instead to keep both.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Import', onPress: () => void merge(path) },
          { text: 'Open', style: 'destructive', onPress: () => void replace(path) },
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
          Alert.alert('Export saved', target.uri);
          return;
        }
        await Sharing.shareAsync(target.uri, {
          UTI: 'org.subsurface.ssrf',
          mimeType: 'application/xml',
          dialogTitle: 'Share logbook',
        });
      } catch (error) {
        operationFailed();
        Alert.alert('Export failed', describeFailure(error));
      } finally {
        setSharing(false);
      }
    })();
  }, [exportTo]);

  const handleIncoming = useCallback(
    async (uri: string) => {
      const path = toNativePath(uri);
      const name = path.slice(path.lastIndexOf('/') + 1);
      // iOS drops the file into Documents/Inbox and never cleans up after
      // itself, so whatever it left there goes once it has been read.
      const done = async (work: Promise<void>) => {
        await work;
        const inbox = new File(uri);
        if (path.includes('/Documents/Inbox/') && inbox.exists) {
          inbox.delete();
        }
      };

      // A single-dive export can only be merged; for a whole logbook both
      // answers are reasonable, so the user picks.
      if (!isLogbookName(name)) {
        await done(merge(path));
        return;
      }
      Alert.alert(name, 'Add these dives to your logbook, or open the file instead?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open', style: 'destructive', onPress: () => void done(replace(path)) },
        { text: 'Import', onPress: () => void done(merge(path)) },
      ]);
    },
    [merge, replace],
  );

  return { busy, importFile, openLogbook, shareLogbook, handleIncoming };
}
