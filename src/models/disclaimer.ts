// AI-generated (Claude)
// Usage disclaimers for the figures the app computes from dive data. The
// planner and the surface GF screen keep their own (PLAN_DISCLAIMER,
// SURFACE_GF_DISCLAIMER); these cover the rest, and say the general case once
// where the app describes itself.


import { t } from '@/i18n';

/**
 * The general statement, in Settings next to the licence: what every
 * calculated figure in the app is, and is not.
 */
export function diveDataDisclaimer(): string {
  return t('disclaimer.diveData');
}

/** Under the Tools list: every tool there is a calculator. */
export function toolsDisclaimer(): string {
  return t('disclaimer.tools');
}

/** At the top of a single calculator (gas, nitrox). */
export function calculatorDisclaimer(): string {
  return t('disclaimer.calculator');
}

/**
 * Under a logged dive's profile: the calculated lines (ceiling, calculated
 * NDL/TTS, tissues, GF) are a model run over the samples, not a measurement.
 */
export function profileCalculationNote(): string {
  return t('disclaimer.profileCalculation');
}
