// AI-generated (Claude)
import type en from '../en/ssi';

const ssi: typeof en = {
  diveCount_one: '{{formatted}} Tauchgang',
  diveCount_other: '{{formatted}} Tauchgänge',
  ratings_one: '{{formatted}} Bewertung',
  ratings_other: '{{formatted}} Bewertungen',
  ratingCaption: '{{stars}}: {{ratings}}',
  water: {
    fresh: 'Süßwasser',
    salt: 'Salzwasser',
    artificial: 'Künstlich',
  },
  diveType: {
    scuba: 'Gerätetauchen',
    frd: 'Apnoetauchen',
    xr: 'Extended Range',
    ccr: 'Geschlossener Kreislauf (CCR)',
    scr: 'Halbgeschlossener Kreislauf (SCR)',
  },
  months: {
    allYear: 'Ganzjährig',
    range: '{{from}} bis {{to}}',
    noData: '{{month}}: keine Daten',
    value: '{{month}}: {{value}} {{unit}}, aus {{dives}}',
    dives: '{{month}}: {{dives}}',
  },
  buddy: {
    last: '{{dives}}, zuletzt {{date}}',
    none: 'Keine gemeinsamen Tauchgänge',
  },
  credentials: {
    emailMissing: 'Gib die E-Mail-Adresse deines SSI-Kontos ein.',
    emailInvalid: 'Das sieht nicht nach einer E-Mail-Adresse aus.',
    passwordMissing: 'Gib dein SSI-Passwort ein.',
  },
  catalogue: {
    endless: 'Die Tauchplatzliste hat kein Ende gefunden.',
    empty: 'Die Tauchplatzliste war leer.',
  },
};

export default ssi;
