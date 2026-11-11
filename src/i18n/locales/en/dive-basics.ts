// AI-generated (Claude)
export default {
  temperature: {
    invalid: 'Enter a temperature, such as 18.',
    range: 'Enter a temperature from {{min}} to {{max}} {{unit}}.',
  },
  when: {
    tooLate: 'The logbook cannot hold a date after 2029.',
    tooEarly: 'The logbook cannot hold a date before 1970.',
    future: 'This date is in the future.',
  },
  duration: {
    missing: 'Enter how long the dive lasted.',
    invalid: 'Enter minutes, such as 45, or hours and minutes, such as 1:05.',
    tooShort: 'A dive lasts longer than that.',
    tooLong: 'A dive cannot last more than 24 hours.',
  },
  depth: {
    missing: 'Enter how deep the dive went.',
    range: 'Enter a depth from {{min}} to {{max}} {{unit}}.',
  },
  meanDepth: {
    invalid: 'Enter a depth, or leave this empty.',
    tooDeep: 'The average has to be less than the maximum depth.',
    tooShallow: 'The average has to be at least a tenth of the maximum depth.',
  },
  number: {
    invalid: 'Enter a whole number, or leave this empty for no number.',
  },
  notes: {
    diveNumber: 'dive {{number}}',
    anotherDive: 'another dive',
    overlaps: 'This overlaps {{name}}.',
    overlapsMore_one: 'This overlaps {{name}} and {{count}} more.',
    overlapsMore_other: 'This overlaps {{name}} and {{count}} more.',
    staysInTrip: 'The dive stays in {{trip}} and keeps its number.',
    staysInItsTrip: 'The dive stays in its trip and keeps its number.',
    withinTrip: 'This falls within {{trip}}. The dive is not added to it; you can do that from the dive.',
    withinATrip: 'This falls within a trip. The dive is not added to it; you can do that from the dive.',
    noNumber: 'Later dives exist, so this one gets no number. You can set one afterwards.',
  },
};
