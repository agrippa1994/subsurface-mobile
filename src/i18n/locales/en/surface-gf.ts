// AI-generated (Claude)
export default {
  gf: 'Surface GF {{gf}}',
  ambient: {
    barometer: 'Phone barometer, {{mbar}} mbar',
    altitude: 'Altitude setting, {{mbar}} mbar',
    seaLevel: 'Sea level, {{mbar}} mbar',
    waiting: 'Waiting for the barometer.',
    noBarometer: 'This phone has no barometer.',
    outOfRange: 'The barometer reading is out of range.',
  },
  preset: {
    minutes_one: '+{{count}} min',
    minutes_other: '+{{count}} min',
    hours_one: '+{{count}} h',
    hours_other: '+{{count}} h',
  },
  planned: {
    was: 'Was {{clock}}',
    in: 'In {{duration}}, {{clock}}',
    beforeEnd: 'Before this dive ended',
    accessibility: 'Planned entry {{when}}. {{gf}}.',
  },
  duration: {
    minutes: '{{minutes}} min',
    hours: '{{hours}} h {{minutes}} min',
    days: '{{days}} d {{hours}} h',
  },
  clock: {
    tomorrow: 'tomorrow {{time}}',
    yesterday: 'yesterday {{time}}',
  },
  disclaimer: 'Surface GF is a Buehlmann model value from your logged profile, not a measurement and not medical advice.',
  singlePressureNote: 'One ambient pressure is applied to the whole surface interval. A drive to altitude part way through is not modelled.',
  explainer: 'Surface GF is how close your leading tissue compartment is to its Buehlmann limit at the surface: 0 % means no compartment holds more nitrogen than the surrounding air pressure, 100 % is the limit itself. Clean means every compartment is within 2 % of the nitrogen it holds at rest; the core forgets a dive after 48 hours.',
  card: {
    since: 'Surfaced {{duration}} ago',
    cleanAt: 'Clean in {{duration}}, {{clock}}',
    zeroIn: '0 % in {{duration}}',
    aboveZero: 'Above 0 % for the whole series',
    residualClean: 'Residual nitrogen, clean in {{duration}}',
  },
  below: {
    staysAbove: 'Stays above {{threshold}} % for the whole series',
    already: 'Already at or below {{threshold}} %',
    in: 'In {{duration}}, {{clock}}',
  },
  span: {
    all: 'All',
  },
  cursor: {
    now: 'Now, {{clock}}',
    ahead: '{{clock}}, in {{duration}}',
    ago: '{{clock}}, {{duration}} ago',
    accessibility: 'Surface GF {{gf}} at {{when}}. {{phase}}.',
  },
  phase: {
    diving: 'Before the end of the dive',
    supersaturated: 'Supersaturated',
    residual: 'Residual nitrogen',
    clean: 'Clean',
  },
};
