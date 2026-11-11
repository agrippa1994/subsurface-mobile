// AI-generated (Claude)
import type en from '../en/git-screen';

const gitScreen: typeof en = {
  switchTitle: 'Repository wechseln?',
  switchMessage: 'Die Synchronisierung beginnt mit dem neuen Repository oder Branch von vorn. Das Logbuch auf diesem Gerät bleibt, wie es ist, und wird bei der nächsten Synchronisierung mit dem Inhalt des neuen zusammengeführt.',
  generateFailed: 'Schlüssel konnte nicht erzeugt werden',
  replaceTitle: 'Schlüssel ersetzen?',
  replaceMessage: 'Der aktuelle Schlüssel wird von diesem Gerät gelöscht. Entferne ihn auch bei deinem Git-Host.',
  readFailed: 'Die Datei konnte nicht gelesen werden',
  notPrivate: 'Kein privater Schlüssel',
  importFailed: 'Der Schlüssel konnte nicht importiert werden',
  passphrase: 'Passphrase',
  passphraseMessage: 'Dieser Schlüssel ist durch eine Passphrase geschützt. Sie wird mit dem Schlüssel im Schlüsselbund aufbewahrt.',
  removeTitle: 'Schlüssel entfernen?',
  removeMessage: 'Die Synchronisierung funktioniert nicht mehr, bis ein neuer Schlüssel hinzugefügt wird.',
  removeFailed: 'Der Schlüssel konnte nicht entfernt werden',
  forgetTitle: '{{host}} vergessen?',
  forgetMessage: 'Die nächste Synchronisierung fragt erneut, ob seinem Host-Schlüssel vertraut werden soll.',
  offTitle: 'Git-Synchronisierung ausschalten?',
  offMessage: 'Die Repository-URL und der Synchronisierungsverlauf auf diesem Gerät werden entfernt. Logbuch, Server und Schlüssel bleiben unberührt.',
  offFailed: 'Synchronisierung konnte nicht ausgeschaltet werden',
  never: 'Nie',
  syncing: 'Wird synchronisiert...',
  notConfigured: 'Richte unten ein Repository und einen Schlüssel ein, um dieses Logbuch mit Git zu synchronisieren.',
  importedKey: 'Importierter Schlüssel. Sein öffentlicher Teil ist nicht in der Datei; verwende die zugehörige .pub-Datei.',
  pulled: 'Gepullt',
  synced: 'Synchronisiert',
  trustTitle: '{{host}} vertrauen?',
  trustServer: 'Diesem Server vertrauen?',
  trustMessage: 'Dies ist die erste Verbindung zum Server. Der Fingerabdruck seines Host-Schlüssels lautet:\n\n{{fingerprint}}\n\nVergleiche ihn mit dem, den dein Git-Host veröffentlicht, bevor du ihm vertraust.',
  trust: 'Vertrauen',
  changedTitle: 'Host-Schlüssel geändert',
  changedMessage: 'Der Server {{host}} hat einen anderen Host-Schlüssel vorgelegt als den bisher vertrauten:\n\n{{fingerprint}}\n\nDas passiert, wenn der Host seine Schlüssel ersetzt, sieht aber auch so aus wie ein Angreifer dazwischen. Vertraue dem neuen Schlüssel nur, wenn dein Git-Host die Änderung angekündigt hat.',
  trustNew: 'Neuem Schlüssel vertrauen',
};

export default gitScreen;
