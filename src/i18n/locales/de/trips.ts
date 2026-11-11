// AI-generated (Claude)
import type en from '../en/trips';

const trips: typeof en = {
  dateRange: '{{first}} bis {{last}}',
  picker: {
    noMatch: 'Keine Reise gefunden.',
    empty: 'Noch keine anderen Reisen. Eine neue Reise beginnt mit diesen Tauchgängen.',
  },
  action: {
    view: 'Reise anzeigen',
    move: 'In Reise verschieben',
    remove: 'Aus Reise entfernen',
    addTo: 'Zu {{trip}} hinzufügen',
    add: 'Zu Reise hinzufügen',
    new: 'Neue Reise',
  },
  summary: {
    dates: 'Daten',
    dives: 'Tauchgänge',
    totalTime: 'Gesamtzeit',
    deepest: 'Tiefster',
    averageDepth: 'Mittlere Tiefe',
    coldestWater: 'Kältestes Wasser',
    leftOut_one: 'Die Summen lassen {{count}} als ungültig markierten Tauchgang aus.',
    leftOut_other: 'Die Summen lassen {{count}} als ungültig markierte Tauchgänge aus.',
  },
};

export default trips;
