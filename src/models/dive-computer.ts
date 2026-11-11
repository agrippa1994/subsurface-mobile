// AI-generated (Claude)
// The decisions behind the dive computer download that are not about rendering:
// what is remembered, which connection goes with which product, how the rows of
// the review list read, and what the outcome of a download says.
//
// The legacy app's behaviour is the reference: DownloadFromDiveComputer.qml,
// and updateRememberedDCs in core/downloadfromdcthread.cpp.

import type {
  BleAdapterState,
  BleDevice,
  DiveComputerIdentity,
  DownloadedDive,
  DownloadStatus,
  ImportResult,
} from '../../modules/ssrf-core/src/SsrfCore.types';
import { formatDiveDateTime } from './date-format';
import { formatDepth, formatDuration, type Units } from './units';
import { t } from '@/i18n';

export type RememberedComputer = DiveComputerIdentity & {
  /** The BLE address. On iOS it only means something on this phone. */
  address: string;
  /** The advertised name, which a few dive computers need handed back. */
  name: string;
};

/** The legacy app keeps four. */
export const MAX_REMEMBERED_COMPUTERS = 4;

function sameComputer(a: RememberedComputer, b: RememberedComputer): boolean {
  return a.vendor === b.vendor && a.product === b.product && a.address === b.address;
}

/** The computer that was just used goes first, whether it is new or not. */
export function rememberComputer(
  list: readonly RememberedComputer[],
  computer: RememberedComputer,
): RememberedComputer[] {
  return [computer, ...list.filter((entry) => !sameComputer(entry, computer))].slice(
    0,
    MAX_REMEMBERED_COMPUTERS,
  );
}

/** Whatever a settings file holds, as far as it is a list of computers. */
export function parseRememberedComputers(value: unknown): RememberedComputer[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: RememberedComputer[] = [];
  for (const entry of value as Partial<RememberedComputer>[]) {
    if (
      typeof entry?.vendor === 'string' &&
      typeof entry.product === 'string' &&
      typeof entry.address === 'string' &&
      entry.vendor !== '' &&
      entry.product !== '' &&
      entry.address !== ''
    ) {
      out.push({
        vendor: entry.vendor,
        product: entry.product,
        address: entry.address,
        name: typeof entry.name === 'string' ? entry.name : '',
      });
    }
  }
  return out.slice(0, MAX_REMEMBERED_COMPUTERS);
}

export function computerLabel(computer: DiveComputerIdentity): string {
  return `${computer.vendor} ${computer.product}`;
}

// --- Connections -------------------------------------------------------------

export function isDiveComputer(device: BleDevice): boolean {
  return device.vendor !== null;
}

/**
 * What the connection picker lists. Headphones and fitness bands are hidden unless
 * asked for, and dive computers come first, the closest one on top. A device known
 * from before reports no signal strength (0), and sorts as if out of range rather
 * than as if it were right there.
 */
export function connectionChoices(devices: readonly BleDevice[], showAll: boolean): BleDevice[] {
  const strength = (device: BleDevice) => (device.rssi === 0 ? -1000 : device.rssi);
  return devices
    .filter((device) => showAll || isDiveComputer(device))
    .sort(
      (a, b) =>
        Number(isDiveComputer(b)) - Number(isDiveComputer(a)) ||
        strength(b) - strength(a) ||
        a.address.localeCompare(b.address),
    );
}

export function connectionLabel(device: Pick<BleDevice, 'name' | 'address'>): string {
  return device.name !== '' ? device.name : device.address;
}

/** The device for a product the user picked by hand, if one is around. */
export function matchingDevice(
  devices: readonly BleDevice[],
  computer: DiveComputerIdentity,
): BleDevice | undefined {
  return devices.find(
    (device) => device.vendor === computer.vendor && device.product === computer.product,
  );
}

/**
 * What to fill in by itself once a scan has found something: only while the form
 * is untouched, and only if there is one obvious answer. The legacy app takes the
 * first find; two dive computers side by side are for the user to tell apart.
 */
export function autoSelection(
  devices: readonly BleDevice[],
  formIsEmpty: boolean,
): (DiveComputerIdentity & { device: BleDevice }) | null {
  if (!formIsEmpty) {
    return null;
  }
  const found = devices.filter(isDiveComputer);
  if (found.length !== 1) {
    return null;
  }
  const [device] = found;
  return { vendor: device.vendor as string, product: device.product as string, device };
}

export function adapterMessage(state: BleAdapterState): string | null {
  switch (state) {
    case 'off':
      return t('download.adapter.off');
    case 'unauthorized':
      return t('download.adapter.unauthorized');
    case 'unsupported':
      return t('download.adapter.unsupported');
    default:
      return null;
  }
}

// --- The review list ----------------------------------------------------------

export type DownloadedDiveRow = {
  index: number;
  dateText: string;
  detailText: string;
};

/** Newest first, as the dive list. `when` is wall-clock as if UTC, see dive-list.ts. */
export function downloadedDiveRows(
  dives: readonly DownloadedDive[],
  units: Units,
): DownloadedDiveRow[] {
  return [...dives]
    .sort((a, b) => b.when - a.when)
    .map((dive) => ({
      index: dive.index,
      dateText: formatDiveDateTime(dive.when),
      detailText: [
        dive.maxDepthMm > 0 ? formatDepth(dive.maxDepthMm, units) : '',
        dive.durationSec > 0 ? formatDuration(dive.durationSec) : '',
      ]
        .filter((text) => text !== '')
        .join(' / '),
    }));
}

export type DownloadOutcome = {
  kind: 'none' | 'running' | 'review' | 'nothing-new' | 'failed' | 'cancelled';
  title: string;
  detail: string;
};

// A dive computer hands out its newest dive first, and the next "only new" download
// stops at the newest dive the logbook has. So if a download breaks off and what came
// through is accepted, the older dives it never reached are skipped from then on.
function partialWarning(): string {
  return t('download.outcome.partial');
}

/** What the screen says about the state of the session. */
export function describeOutcome(status: DownloadStatus): DownloadOutcome {
  const got = status.dives.length;
  switch (status.state) {
    case 'idle':
      return { kind: 'none', title: '', detail: '' };
    case 'running':
      return { kind: 'running', title: t('download.outcome.running'), detail: status.text };
    case 'finished':
      return got > 0
        ? { kind: 'review', title: t('download.outcome.downloaded', { count: got }), detail: '' }
        : {
            kind: 'nothing-new',
            title: t('download.outcome.nothingNew'),
            detail: t('download.outcome.nothingNewDetail'),
          };
    case 'failed': {
      if (got > 0) {
        return { kind: 'review', title: t('download.outcome.downloaded', { count: got }), detail: partialWarning() };
      }
      const reasons = status.errors.length > 0 ? `\n${status.errors.join('\n')}` : '';
      return {
        kind: 'failed',
        title: t('download.outcome.failed'),
        detail: `${status.error}${reasons}`,
      };
    }
    case 'cancelled':
      return got > 0
        ? { kind: 'review', title: t('download.outcome.downloaded', { count: got }), detail: partialWarning() }
        : { kind: 'cancelled', title: t('download.outcome.cancelled'), detail: '' };
  }
}

export function acceptSummary(result: ImportResult): string {
  const parts: string[] = [];
  if (result.added > 0) {
    parts.push(t('download.accept.added', { count: result.added }));
  }
  if (result.merged > 0) {
    parts.push(t('download.accept.merged', { count: result.merged }));
  }
  return parts.length > 0 ? `${parts.join(', ')}.` : t('download.accept.nothing');
}
