// AI-generated (Claude)
// Exporting one dive as CSV, the way desktop Subsurface's export dialog does:
// the module writes the file (see exportDiveCSV in modules/ssrf-core), this
// hands it to the share sheet. File names and labels are src/models/transfer.ts.

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { operationFailed } from '@/lib/haptics';
import { toNativePath } from '@/lib/logbook-file';
import type { CsvFormat, DiveSummary } from '@/models';
import { describeError } from '@/models/errors';
import { csvFileName } from '@/models/transfer';
import { useExportDiveCSV } from '@/queries/logbook-mutations';
import { useGradientFactors, useUnitSystem } from '@/queries/settings';

export type DiveCsvExport = {
  /** True while a file is being written and shared. */
  busy: boolean;
  /** Writes the dive in `format` to a temp file and opens the share sheet. */
  share: (format: CsvFormat) => void;
};

export function useDiveCsvExport(dive: Pick<DiveSummary, 'id' | 'number' | 'when'>): DiveCsvExport {
  const exportCsv = useExportDiveCSV();
  // The stylesheets write in the unit system the app shows; the computed
  // profile follows the gradient factors the diagram is drawn with.
  const imperial = useUnitSystem() === 'imperial';
  const gf = useGradientFactors();

  const share = useCallback(
    (format: CsvFormat) => {
      void (async () => {
        try {
          const target = new File(Paths.cache, csvFileName(dive, format));
          if (target.exists) {
            target.delete();
          }
          await exportCsv.mutateAsync({
            id: dive.id,
            path: toNativePath(target.uri),
            options: { format, imperial, gf },
          });
          if (!(await Sharing.isAvailableAsync())) {
            Alert.alert('Export saved', target.uri);
            return;
          }
          await Sharing.shareAsync(target.uri, {
            UTI: 'public.comma-separated-values-text',
            mimeType: 'text/csv',
            dialogTitle: 'Share dive',
          });
        } catch (error) {
          operationFailed();
          const info = describeError(error);
          Alert.alert('Export failed', [info.message, ...info.details].join('\n\n'));
        }
      })();
    },
    [dive, exportCsv, gf, imperial],
  );

  return { busy: exportCsv.isPending, share };
}
