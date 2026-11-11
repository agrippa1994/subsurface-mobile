// AI-generated (Claude)
import type en from '../en/transfer';

const transfer: typeof en = {
  csv: {
    details: {
      label: 'Profilwerte',
      description: 'Die Messwerte, wie sie vom Tauchcomputer heruntergeladen wurden.',
    },
    summary: {
      label: 'Tauchgang-Übersicht',
      description: 'Eine Zeile mit den Details des Tauchgangs, ohne Profil.',
    },
    profile: {
      label: 'Berechnetes Profil',
      description: 'Alles, was das Profildiagramm berechnet, Messwert für Messwert.',
    },
  },
  import: {
    added_one: '{{count}} Tauchgang hinzugefügt',
    added_other: '{{count}} Tauchgänge hinzugefügt',
    merged_one: '{{count}} Tauchgang bereits im Logbuch',
    merged_other: '{{count}} Tauchgänge bereits im Logbuch',
    failed_one: '{{count}} Datei konnte nicht gelesen werden',
    failed_other: '{{count}} Dateien konnten nicht gelesen werden',
    nothing: 'Nichts zu importieren.',
    summary_one: '{{parts}}. Das Logbuch enthält jetzt {{count}} Tauchgang.',
    summary_other: '{{parts}}. Das Logbuch enthält jetzt {{count}} Tauchgänge.',
  },
};

export default transfer;
