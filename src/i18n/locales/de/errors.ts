// AI-generated (Claude)
import type en from '../en/errors';

const errors: typeof en = {
  unreadable: 'Das Logbuch konnte nicht gelesen werden.',
  unknown: 'Unbekannter Fehler',
  noLogbook: 'Es ist kein Logbuch geöffnet, daher konnte die Änderung nicht gesichert werden.',
  syncRunning: 'Eine Synchronisierung läuft. Versuche es erneut, wenn sie beendet ist.',
  ssi: {
    noLookups: 'SSI hat keine Nachschlagetabellen geliefert.',
    noSite: 'SSI konnte diesen Tauchplatz nicht liefern. Aktualisiere den Katalog in den Einstellungen.',
    http: 'SSI hat HTTP {{status}} zurückgegeben.',
    refused: 'SSI hat die Anfrage abgelehnt.',
    noCatalogue: 'Der Tauchplatz-Download enthielt keinen Katalog.',
    emptyCatalogue: 'Der Tauchplatzkatalog war leer.',
    noSiteList: 'SSI hat keine Tauchplatzliste geliefert.',
    shortList: 'Die Tauchplatzliste endete vor dem vollständigen Katalog.',
    noToken: 'SSI hat die Anmeldung akzeptiert, aber kein Sitzungstoken gesendet.',
    signInFirst: 'Melde dich zuerst in den Einstellungen bei SSI an.',
    noDives: 'SSI hat keine Tauchgänge geliefert, daher bleibt das Logbuch unverändert.',
  },
  git: {
    noUrl: 'Lege zuerst die Repository-URL fest.',
    passphrase: 'Dieser Schlüssel ist durch eine Passphrase geschützt.',
    noRepository: 'Richte zuerst das Repository ein.',
    noKey: 'Erzeuge oder importiere zuerst einen SSH-Schlüssel.',
  },
};

export default errors;
