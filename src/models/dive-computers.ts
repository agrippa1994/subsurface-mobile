// AI-generated (Claude)
// Presentation model for a dive recorded by more than one dive computer.
//
// Pure functions only. The core keeps two sets of figures: each computer's own,
// and the dive's, which fixup_dive derives from them (deepest, longest, averaged
// mean depth). The detail screen shows the dive's at the top and the selected
// computer's next to its name, so this file decides what belongs to a computer.

import { DiveMode, type DiveComputer } from './index';
import { formatDepth, formatDuration, formatTemperature, type Units } from './units';
import { t } from '@/i18n';

/** A dive mode's name; an unknown one reads as open circuit, which is 0. */
export function diveModeLabel(mode: DiveMode): string {
  switch (mode) {
    case DiveMode.CCR:
      return 'CCR';
    case DiveMode.PSCR:
      return 'pSCR';
    case DiveMode.Freedive:
      return t('diveComputers.mode.freedive');
    default:
      return t('diveComputers.mode.openCircuit');
  }
}

/** Which computer a screen has selected, tied to the dive it was selected on. */
export type ComputerSelection = { diveId: number; index: number };

/**
 * The index to show. A selection made on another dive does not carry over, and
 * one past the end (the dive lost a computer) falls back to the first:
 * getProfile rejects an index out of range rather than wrapping it.
 */
export function selectedComputerIndex(
  selection: ComputerSelection,
  diveId: number,
  computerCount: number,
): number {
  if (selection.diveId !== diveId) {
    return 0;
  }
  return selection.index >= 0 && selection.index < computerCount ? selection.index : 0;
}

/**
 * One name per computer, each telling them apart. Two of the same model are
 * common (a diver's backup, or the same computer downloaded twice), so a repeated
 * model takes its serial, and failing that its position.
 */
export function computerLabels(computers: readonly DiveComputer[]): string[] {
  const named = computers.map((dc) => upperFirst(dc.model.trim()) || t('diveComputers.unknown'));
  const repeated = (list: readonly string[], index: number) =>
    list.filter((name) => name === list[index]).length > 1;

  const withSerials = named.map((name, index) =>
    repeated(named, index) && computers[index].serial
      ? `${name} (${computers[index].serial})`
      : name,
  );
  return withSerials.map((name, index) =>
    repeated(withSerials, index) ? `${name} (${index + 1})` : name,
  );
}

/**
 * What VoiceOver reads as the picker's value. The position matters here, because
 * the screen shows only the selected name.
 */
export function computerPositionText(label: string, index: number, count: number): string {
  return t('diveComputers.position', { label, index: index + 1, count });
}

/**
 * The figures a computer recorded for itself, for a dive with several. Zero means
 * "not recorded" throughout the core, so a zero leaves its row out. Mode is always
 * there: it belongs to the computer, and open circuit is 0.
 */
export function computerFigures(
  dc: DiveComputer,
  units: Units,
): { label: string; value: string }[] {
  const figures = [
    { label: t('diveComputers.figure.mode'), value: diveModeLabel(dc.divemode) },
  ];
  if (dc.maxDepthMm > 0) {
    figures.push({ label: t('diveComputers.figure.maxDepth'), value: formatDepth(dc.maxDepthMm, units) });
  }
  if (dc.meanDepthMm > 0) {
    figures.push({ label: t('diveComputers.figure.averageDepth'), value: formatDepth(dc.meanDepthMm, units) });
  }
  if (dc.durationSec > 0) {
    figures.push({ label: t('diveComputers.figure.duration'), value: formatDuration(dc.durationSec) });
  }
  if (dc.waterTempMkelvin > 0) {
    figures.push({ label: t('diveComputers.figure.water'), value: formatTemperature(dc.waterTempMkelvin, units) });
  }
  if (dc.airTempMkelvin > 0) {
    figures.push({ label: t('diveComputers.figure.air'), value: formatTemperature(dc.airTempMkelvin, units) });
  }
  return figures;
}

/**
 * A PlotInfo's maximum depth and time are the dive's whichever computer was
 * plotted, and the chart reads them out as "maximum depth" and "total". With
 * several computers that would credit the selected one with another's figures, so
 * the plot takes its own: the computer's depth, and the end of its samples. With
 * one computer the plot is left as it is.
 */
export function plotForComputer<
  P extends { maxDepthMm: number; maxSec: number; depth: readonly { sec: number }[] },
>(plot: P, computers: readonly DiveComputer[], index: number): P {
  if (computers.length < 2) {
    return plot;
  }
  return {
    ...plot,
    maxDepthMm: computers[index]?.maxDepthMm || plot.maxDepthMm,
    maxSec: plot.depth[plot.depth.length - 1]?.sec ?? plot.maxSec,
  };
}

function upperFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/** The action that moves a dive's selected computer to the front. */
export function makeFirstLabel(): string {
  return t('diveComputers.makeFirst');
}
