// AI-generated (Claude)
import type en from '../en/download';

const download: typeof en = {
  adapter: {
    off: 'Bluetooth ist aus. Schalte es ein, um nach deinem Tauchcomputer zu suchen.',
    unauthorized: 'Subsurface darf Bluetooth nicht verwenden. Du kannst das in den Systemeinstellungen ändern.',
    unsupported: 'Dieses Gerät hat kein Bluetooth LE. Der iOS-Simulator auch nicht.',
  },
  outcome: {
    partial: 'Der Download wurde vorzeitig beendet. Wenn du diese behältst, findet ein späterer Download nur neuere Tauchgänge: Um die älteren zu bekommen, verwende „Alle Tauchgänge herunterladen erzwingen“.',
    running: 'Wird heruntergeladen',
    downloaded_one: '{{count}} Tauchgang heruntergeladen',
    downloaded_other: '{{count}} Tauchgänge heruntergeladen',
    nothingNew: 'Keine neuen Tauchgänge',
    nothingNewDetail: 'Alles auf dem Tauchcomputer ist bereits in diesem Logbuch.',
    failed: 'Der Download ist fehlgeschlagen',
    cancelled: 'Download abgebrochen',
  },
  accept: {
    added_one: '{{count}} Tauchgang hinzugefügt',
    added_other: '{{count}} Tauchgänge hinzugefügt',
    merged_one: '{{count}} Tauchgang mit Tauchgängen im Logbuch zusammengeführt',
    merged_other: '{{count}} Tauchgänge mit Tauchgängen im Logbuch zusammengeführt',
    nothing: 'Nichts geändert.',
    button_one: '{{count}} Tauchgang übernehmen',
    button_other: '{{count}} Tauchgänge übernehmen',
  },
  choose: 'Auswählen',
  connecting: 'Verbinden',
  looking: 'Suche nach Tauchcomputern. Schalte Bluetooth an deinem ein und halte ihn in der Nähe.',
  selectAll: 'Alle auswählen',
  unselectAll: 'Alle abwählen',
  discardTitle: 'Heruntergeladene Tauchgänge verwerfen?',
  discardMessage: 'Sie bleiben auf dem Tauchcomputer.',
  keepReviewing: 'Weiter prüfen',
  log: 'Tauchcomputer-Protokoll',
  retry: 'Erneut versuchen',
  download: 'Herunterladen',
};

export default download;
