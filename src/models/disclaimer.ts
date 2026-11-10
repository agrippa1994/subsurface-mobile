// AI-generated (Claude)
// Usage disclaimers for the figures the app computes from dive data. The
// planner and the surface GF screen keep their own (PLAN_DISCLAIMER,
// SURFACE_GF_DISCLAIMER); these cover the rest, and say the general case once
// where the app describes itself.

/**
 * The general statement, in Settings next to the licence: what every
 * calculated figure in the app is, and is not.
 */
export const DIVE_DATA_DISCLAIMER =
  'Subsurface Mobile is a logbook and a set of planning aids, not a dive ' +
  'computer and not a medical device. Decompression, no-deco limits, TTS, ' +
  'ceilings, tissue loading, oxygen exposure, MOD, END and best mix are ' +
  'computed from published models and from the data you logged or entered. ' +
  'They can be wrong, have had limited testing, and are not medical advice. ' +
  'Do not plan or conduct a dive on these figures alone: check them against ' +
  'another source and your dive computer, and dive within your training.';

/** Under the Tools list: every tool there is a calculator. */
export const TOOLS_DISCLAIMER =
  'These tools are planning and training aids. Their results can be wrong. ' +
  'Check them against another source and your dive computer, and dive within ' +
  'your training and certification.';

/** At the top of a single calculator (gas, nitrox). */
export const CALCULATOR_DISCLAIMER =
  'A planning aid, not a substitute for training or a dive computer. Check ' +
  'every figure before you rely on it.';

/**
 * Under a logged dive's profile: the calculated lines (ceiling, calculated
 * NDL/TTS, tissues, GF) are a model run over the samples, not a measurement.
 */
export const PROFILE_CALCULATION_NOTE =
  'Ceiling, calculated NDL and TTS, tissue and GF values are Buehlmann model ' +
  'estimates from the logged profile, not measurements and not medical advice.';
