// AI-generated (Claude)
import type en from '../en/dive-basics';

const diveBasics: typeof en = {
  temperature: {
    invalid: 'Gib eine Temperatur ein, zum Beispiel 18.',
    range: 'Gib eine Temperatur von {{min}} bis {{max}} {{unit}} ein.',
  },
  when: {
    tooLate: 'Das Logbuch kann kein Datum nach 2029 speichern.',
    tooEarly: 'Das Logbuch kann kein Datum vor 1970 speichern.',
    future: 'Dieses Datum liegt in der Zukunft.',
  },
  duration: {
    missing: 'Gib an, wie lange der Tauchgang gedauert hat.',
    invalid: 'Gib Minuten ein, zum Beispiel 45, oder Stunden und Minuten, zum Beispiel 1:05.',
    tooShort: 'Ein Tauchgang dauert länger.',
    tooLong: 'Ein Tauchgang kann nicht länger als 24 Stunden dauern.',
  },
  depth: {
    missing: 'Gib an, wie tief der Tauchgang ging.',
    range: 'Gib eine Tiefe von {{min}} bis {{max}} {{unit}} ein.',
  },
  meanDepth: {
    invalid: 'Gib eine Tiefe ein oder lass das Feld leer.',
    tooDeep: 'Der Durchschnitt muss geringer als die maximale Tiefe sein.',
    tooShallow: 'Der Durchschnitt muss mindestens ein Zehntel der maximalen Tiefe betragen.',
  },
  number: {
    invalid: 'Gib eine ganze Zahl ein oder lass das Feld für keine Nummer leer.',
  },
  notes: {
    diveNumber: 'Tauchgang {{number}}',
    anotherDive: 'einen anderen Tauchgang',
    overlaps: 'Dies überschneidet sich mit {{name}}.',
    overlapsMore_one: 'Dies überschneidet sich mit {{name}} und {{count}} weiteren.',
    overlapsMore_other: 'Dies überschneidet sich mit {{name}} und {{count}} weiteren.',
    staysInTrip: 'Der Tauchgang bleibt in {{trip}} und behält seine Nummer.',
    staysInItsTrip: 'Der Tauchgang bleibt in seiner Reise und behält seine Nummer.',
    withinTrip: 'Dies fällt in den Zeitraum von {{trip}}. Der Tauchgang wird nicht hinzugefügt; das kannst du beim Tauchgang selbst tun.',
    withinATrip: 'Dies fällt in den Zeitraum einer Reise. Der Tauchgang wird nicht hinzugefügt; das kannst du beim Tauchgang selbst tun.',
    noNumber: 'Es gibt spätere Tauchgänge, daher bekommt dieser keine Nummer. Du kannst später eine vergeben.',
  },
};

export default diveBasics;
