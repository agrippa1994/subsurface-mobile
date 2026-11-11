// AI-generated (Claude)
import type en from '../en/git';

const git: typeof en = {
  result: {
    upToDate: 'Das Logbuch ist auf dem neuesten Stand.',
    sentPushed: 'Deine Änderungen wurden committet und gepusht.',
    sent: 'Deine Änderungen wurden committet. Sie erreichen den Server mit dem nächsten Push.',
    received: 'Das Logbuch wurde mit den Änderungen vom Server aktualisiert.',
    merged: 'Die Änderungen vom Server wurden mit deinen zusammengeführt.',
    mergedPushed: 'Die Änderungen vom Server wurden mit deinen zusammengeführt und gepusht.',
  },
  error: {
    authTitle: 'Der Server hat den Schlüssel abgelehnt',
    authMessage: 'Füge den öffentlichen Schlüssel beim Repository-Host hinzu (als Deploy-Key mit Schreibzugriff oder in deinem Konto), oder prüfe die Passphrase eines importierten Schlüssels.',
    pushTitle: 'Der Server hat den Push abgelehnt',
    pushMessage: 'Das Repository hat sich während der Synchronisierung geändert, oder der Branch ist geschützt. Synchronisiere erneut, um zuerst seine Änderungen zu übernehmen.',
    keyTitle: 'Der SSH-Schlüssel konnte nicht verwendet werden',
    keyMessage: 'Die Passphrase ist falsch oder die Schlüsseldatei ist beschädigt. Importiere den Schlüssel erneut.',
    failed: 'Synchronisierung fehlgeschlagen',
  },
  head: {
    none: 'Noch keine Commits',
  },
  server: {
    neverPushed: 'Noch nicht gepusht',
    ahead_one: '{{count}} zum Pushen',
    ahead_other: '{{count}} zum Pushen',
    behind_one: '{{count}} zum Pullen',
    behind_other: '{{count}} zum Pullen',
    inSync: 'Synchron',
  },
  remote: {
    empty: 'Gib die Repository-URL ein.',
    https: 'Derzeit werden nur SSH-URLs unterstützt, zum Beispiel git@github.com:du/logbuch.git.',
    invalid: 'Dies ist keine SSH-Repository-URL wie git@github.com:du/logbuch.git.',
  },
  config: {
    branch: 'Kein gültiger Branch-Name.',
    path: 'Ein relativer Dateipfad, zum Beispiel logbook.ssrf.',
    authorName: 'Commits brauchen einen Autorennamen.',
    authorEmail: 'Commits brauchen eine E-Mail-Adresse.',
  },
  key: {
    truncated: 'Die Schlüsseldatei ist abgeschnitten.',
    public: 'Dies ist ein öffentlicher Schlüssel. Wähle die private Schlüsseldatei (die ohne .pub).',
    incomplete: 'Die Schlüsseldatei ist unvollständig.',
    notOpenssh: 'Dies ist kein privater OpenSSH-Schlüssel.',
    empty: 'Die Schlüsseldatei enthält keinen Schlüssel.',
    notPrivate: 'Dies ist kein privater SSH-Schlüssel.',
  },
};

export default git;
