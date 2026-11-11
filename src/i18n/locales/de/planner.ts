// AI-generated (Claude)
import type en from '../en/planner';

const planner: typeof en = {
  shortDisclaimer: 'Ein Plan ersetzt weder Ausbildung noch Tauchcomputer.',
  disclaimer: 'Ein Plan ersetzt weder Ausbildung noch Tauchcomputer. Diese Berechnung wurde nur begrenzt getestet. Prüfe sie mit einer anderen Quelle und tauche im Rahmen deiner Ausbildung.',
  water: {
    salt: 'Salzwasser',
    fresh: 'Süßwasser',
  },
  openCircuit: 'Offener Kreislauf',
  cylinderSummary: '{{tank}}, gefüllt auf {{pressure}}',
  firstLevelTooShort: 'Die erste Stufe ist kürzer als der Abstieg von {{minutes}} min auf {{depth}}. Gib ihr mehr Zeit oder wähle eine geringere Tiefe.',
  minutes: '{{minutes}} min',
  gas: {
    usedOf: '{{used}} von {{carried}}',
    endsAt: 'Endet bei {{end}} von {{start}}',
    minimum: 'Mindestgas {{pressure}}',
    inAscent: '{{volume}} im Aufstieg',
    switchAt: 'Wechsel auf {{depth}}',
  },
  warning: {
    aboveCeiling: 'Eine geplante Stufe liegt flacher als die Dekompressionsgrenze an dieser Stelle. Plane eine tiefere Stufe oder einen kürzeren Tauchgang davor.',
    belowMinimum: 'Unter Mindestgas: {{name}} hat zu Beginn des Aufstiegs {{pressure}}, das Minimum ist {{minimum}}.',
    overlap: 'Dieser Plan überschneidet sich mit einem Tauchgang im Logbuch. Prüfe die Startzeit.',
  },
  failure: 'Der Planer konnte diesen Plan nicht berechnen.',
  headline: {
    noStops: 'Keine Stopps · {{ascent}} Aufstieg',
    stops_one: '{{count}} Stopp, {{stopTime}} · {{ascent}} Aufstieg',
    stops_other: '{{count}} Stopps, {{stopTime}} · {{ascent}} Aufstieg',
  },
  repetitive: 'Wiederholungstauchgang: {{interval}} h nach dem vorherigen Tauchgang im Logbuch, dessen Gewebesättigung berücksichtigt ist.',
};

export default planner;
