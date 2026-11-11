// AI-generated (Claude)
export default {
  shortDisclaimer: 'A plan is not a substitute for training or a dive computer.',
  disclaimer: 'A plan is not a substitute for training or a dive computer. This calculation has had limited testing. Check it against another source, and dive within your training.',
  water: {
    salt: 'Salt',
    fresh: 'Fresh',
  },
  openCircuit: 'Open circuit',
  cylinderSummary: '{{tank}}, filled to {{pressure}}',
  firstLevelTooShort: 'The first level is shorter than the {{minutes}} min descent to {{depth}}. Give it more time, or a shallower depth.',
  minutes: '{{minutes}} min',
  gas: {
    usedOf: '{{used}} of {{carried}}',
    endsAt: 'Ends at {{end}} of {{start}}',
    minimum: 'Minimum gas {{pressure}}',
    inAscent: '{{volume}} in the ascent',
    switchAt: 'Switch at {{depth}}',
  },
  warning: {
    aboveCeiling: 'A planned level is shallower than the deco ceiling at that point. Plan a deeper level or a shorter dive before it.',
    belowMinimum: 'Below minimum gas: {{name}} is at {{pressure}} when the ascent starts, and the minimum is {{minimum}}.',
    overlap: 'This plan overlaps a dive in the logbook. Check the start time.',
  },
  failure: 'The planner could not work out this plan.',
  headline: {
    noStops: 'No stops · {{ascent}} ascent',
    stops_one: '{{count}} stop, {{stopTime}} · {{ascent}} ascent',
    stops_other: '{{count}} stops, {{stopTime}} · {{ascent}} ascent',
  },
  repetitive: 'Repetitive dive: {{interval}} h after the previous dive in the logbook, whose tissue loading is included.',
};
