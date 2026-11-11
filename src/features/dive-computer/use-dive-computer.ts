// AI-generated (Claude)
// The state of the download screen, minus the rendering.
//
// The module holds the truth: this hook re-reads the session and the scan whenever
// the module pushes an event, and on mount, so a screen that was closed and opened
// again finds a finished download still waiting for review. It holds no copy of
// anything beyond what the form has chosen.

import { useKeepAwake } from 'expo-keep-awake';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';

import {
  addCoreEventListener,
  bleScanStart,
  bleScanStatus,
  bleScanStop,
  configureDownloads,
  dcDownloadCancel,
  dcDownloadDiscard,
  dcDownloadStart,
  dcDownloadStatus,
  dcListComputers,
  type BleDevice,
  type BleScanStatus,
  type DiveComputerVendor,
  type DownloadStatus,
} from '../../../modules/ssrf-core/src';

import { recordProblem } from '@/lib/diagnostics';
import { operationFailed, operationSucceeded, warned } from '@/lib/haptics';
import {
  acceptSummary,
  autoSelection,
  connectionChoices,
  describeOutcome,
  matchingDevice,
  type DownloadOutcome,
  type RememberedComputer,
} from '@/models/dive-computer';
import { importNeedsExplaining } from '@/models/transfer';
import { describeError, formatErrorLine } from '@/models/errors';
import { useAcceptDownload } from '@/queries/logbook-mutations';
import {
  useRememberComputer,
  useRememberedComputers,
  useSettings,
  useUpdateSettings,
} from '@/queries/settings';
import { t } from '@/i18n';

/** Asks Android for what a scan needs. iOS asks by itself when the scan starts. */
async function ensureBluetoothPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  const version = typeof Platform.Version === 'number' ? Platform.Version : 0;
  const permissions =
    version >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const results = await PermissionsAndroid.requestMultiple(permissions);
  return Object.values(results).every((result) => result === PermissionsAndroid.RESULTS.GRANTED);
}

export type DiveComputerForm = {
  vendors: DiveComputerVendor[];
  vendor: string;
  product: string;
  /** Empty until picked. A remembered computer may not be in the scan. */
  connection: Pick<BleDevice, 'address' | 'name'> | null;
  products: string[];
  setVendor: (vendor: string) => void;
  setProduct: (product: string) => void;
  setConnection: (device: BleDevice) => void;
  pickRemembered: (computer: RememberedComputer) => void;
  remembered: RememberedComputer[];
};

export type DiveComputerScreen = DiveComputerForm & {
  scan: BleScanStatus;
  choices: BleDevice[];
  showAllDevices: boolean;
  setShowAllDevices: (show: boolean) => void;
  rescan: () => void;
  permissionDenied: boolean;

  force: boolean;
  setForce: (force: boolean) => void;
  syncTime: boolean;
  setSyncTime: (sync: boolean) => void;

  status: DownloadStatus;
  outcome: DownloadOutcome;
  running: boolean;
  canDownload: boolean;
  /** "Retry" once something has gone wrong, as in the legacy app. */
  downloadLabel: string;
  download: () => void;
  cancel: () => void;

  selected: ReadonlySet<number>;
  toggle: (index: number) => void;
  selectAll: () => void;
  selectNone: () => void;
  accepting: boolean;
  accept: () => void;
  discard: () => void;
  shareLog: (() => void) | null;
};

type Picked = Pick<DiveComputerForm, 'vendor' | 'product' | 'connection'>;

const NO_SCAN: BleScanStatus = { adapter: 'unknown', scanning: false, available: true, devices: [] };

export function useDiveComputer(onDone: () => void): DiveComputerScreen {
  const settings = useSettings();
  const update = useUpdateSettings();
  const remembered = useRememberedComputers();
  const remember = useRememberComputer();
  const acceptDownload = useAcceptDownload();

  const [vendors] = useState(dcListComputers);
  // Null until the user has touched the form; until then a scan may fill it in.
  const [picked, setPicked] = useState<Picked | null>(null);
  const [showAllDevices, setShowAllDevices] = useState(false);
  const [force, setForce] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [scan, setScan] = useState<BleScanStatus>(NO_SCAN);
  const [status, setStatus] = useState<DownloadStatus>(() => {
    // Before the first status, or the log would land next to nothing useful.
    configureDownloads(pathOf(Paths.cache.uri));
    return dcDownloadStatus();
  });
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => allOf(status));

  const running = status.state === 'running';

  const detected = picked === null ? autoSelection(scan.devices, true) : null;
  const vendor = picked?.vendor ?? detected?.vendor ?? '';
  const product = picked?.product ?? detected?.product ?? '';
  const connection = picked ? picked.connection : (detected?.device ?? null);

  // The screen is held on: iOS suspends the app when it locks, which ends the BLE
  // link and with it the download.
  useKeepAwake();

  // The newest values for the handlers below, which live as long as the screen.
  const form = useRef({ vendor, product, connection, remembered });
  useEffect(() => {
    form.current = { vendor, product, connection, remembered };
  }, [vendor, product, connection, remembered]);

  const beginScan = useCallback((granted: boolean) => {
    setPermissionDenied(!granted);
    if (!granted) {
      return;
    }
    try {
      bleScanStart(form.current.remembered.map((computer) => computer.address));
      setScan(bleScanStatus());
    } catch (error) {
      recordProblem('Bluetooth scan', error);
    }
  }, []);

  const refreshStatus = useCallback(() => {
    const next = dcDownloadStatus();
    setStatus(next);
    if (next.state === 'running') {
      return;
    }
    // Every dive is ticked to begin with, as in the legacy app.
    setSelected(allOf(next));
    return next;
  }, []);

  // A download that reached the dive computer is worth offering again; the device
  // may have corrected which product it is.
  const onDownloadEnded = useCallback(
    (ended: DownloadStatus) => {
      if (ended.state === 'failed' && ended.diveCount === 0) {
        recordProblem('Dive computer download', new Error(ended.error));
        operationFailed();
      } else if (ended.state === 'finished') {
        operationSucceeded();
      }
      if (ended.state === 'finished' || ended.diveCount > 0) {
        remember({
          vendor: ended.vendor,
          product: ended.product,
          address: ended.address,
          name: form.current.connection?.name ?? '',
        });
      }
    },
    [remember],
  );

  useEffect(() => {
    // Scan results come in a burst; one re-read per burst is plenty.
    let scanTimer: ReturnType<typeof setTimeout> | null = null;
    const subscription = addCoreEventListener((event) => {
      if (event.type === 'download') {
        if (event.state === 'running') {
          // The whole status has nothing else that moves during a download.
          setStatus((current) => ({ ...current, ...event }));
        } else {
          const ended = refreshStatus();
          if (ended) {
            onDownloadEnded(ended);
          }
        }
      } else if (scanTimer === null) {
        scanTimer = setTimeout(() => {
          scanTimer = null;
          setScan(bleScanStatus());
        }, 150);
      }
    });
    void ensureBluetoothPermission().then(beginScan);
    return () => {
      subscription.remove();
      if (scanTimer !== null) {
        clearTimeout(scanTimer);
      }
      bleScanStop();
      // The back gesture is off while running, but the screen can still go away
      // (another tab replacing the stack). Better a cancel than an orphan.
      if (dcDownloadStatus().state === 'running') {
        dcDownloadCancel();
      }
    };
  }, [beginScan, onDownloadEnded, refreshStatus]);

  const setVendor = useCallback((next: string) => {
    setPicked({ vendor: next, product: '', connection: form.current.connection });
  }, []);

  const setProduct = useCallback(
    (next: string) => {
      const { vendor: currentVendor, connection: current } = form.current;
      // As the legacy app: a product that is in the scan brings its connection along.
      const device = matchingDevice(scan.devices, { vendor: currentVendor, product: next });
      setPicked({ vendor: currentVendor, product: next, connection: device ?? current });
    },
    [scan.devices],
  );

  const setConnection = useCallback((device: BleDevice) => {
    const { vendor: currentVendor, product: currentProduct } = form.current;
    setPicked({
      vendor: device.vendor ?? currentVendor,
      product: device.product ?? currentProduct,
      connection: device,
    });
  }, []);

  const pickRemembered = useCallback((computer: RememberedComputer) => {
    setPicked({
      vendor: computer.vendor,
      product: computer.product,
      connection: { address: computer.address, name: computer.name },
    });
  }, []);

  const products = useMemo(
    () => vendors.find((entry) => entry.vendor === vendor)?.products ?? [],
    [vendors, vendor],
  );

  const choices = useMemo(
    () => connectionChoices(scan.devices, showAllDevices),
    [scan.devices, showAllDevices],
  );

  const download = useCallback(() => {
    if (!connection) {
      return;
    }
    try {
      bleScanStop();
      dcDownloadStart({
        vendor,
        product,
        address: connection.address,
        btName: connection.name,
        force,
        syncTime: settings.syncDiveComputerTime,
      });
      setStatus(dcDownloadStatus());
    } catch (error) {
      operationFailed();
      recordProblem('Dive computer download', error);
      Alert.alert(t('alerts.downloadFailed'), formatErrorLine(describeError(error)));
    }
  }, [connection, force, product, settings.syncDiveComputerTime, vendor]);

  const accept = useCallback(() => {
    void (async () => {
      try {
        const result = await acceptDownload.mutateAsync([...selected]);
        operationSucceeded();
        refreshStatus();
        // As an import: a plain result is the toast's to report, with its Undo.
        if (importNeedsExplaining(result)) {
          Alert.alert(t('alerts.downloaded'), acceptSummary(result));
        }
        onDone();
      } catch (error) {
        operationFailed();
        recordProblem('Accepting downloaded dives', error);
        Alert.alert(t('alerts.saveFailed'), formatErrorLine(describeError(error)));
      }
    })();
  }, [acceptDownload, onDone, refreshStatus, selected]);

  const discard = useCallback(() => {
    const finish = () => {
      dcDownloadDiscard();
      refreshStatus();
      onDone();
    };
    if (selected.size === 0) {
      finish();
      return;
    }
    warned();
    Alert.alert(t('download.discardTitle'), t('download.discardMessage'), [
      { text: t('download.keepReviewing'), style: 'cancel' },
      { text: t('ui.discard'), style: 'destructive', onPress: finish },
    ]);
  }, [onDone, refreshStatus, selected.size]);

  const logPath = status.logPath;
  const shareLog = useMemo(() => {
    if (logPath === '' || status.state === 'idle' || status.state === 'running') {
      return null;
    }
    return () => {
      void Sharing.shareAsync(new File(`file://${logPath}`).uri, {
        mimeType: 'text/plain',
        UTI: 'public.plain-text',
        dialogTitle: t('download.log'),
      }).catch((error: unknown) => {
        Alert.alert(t('alerts.logFailed'), formatErrorLine(describeError(error)));
      });
    };
  }, [logPath, status.state]);

  const outcome = useMemo(() => describeOutcome(status), [status]);
  const wentWrong = outcome.kind === 'failed' || outcome.kind === 'cancelled';

  return {
    vendors,
    vendor,
    product,
    connection,
    products,
    setVendor,
    setProduct,
    setConnection,
    pickRemembered,
    remembered,

    scan,
    choices,
    showAllDevices,
    setShowAllDevices,
    rescan: () => void ensureBluetoothPermission().then(beginScan),
    permissionDenied,

    force,
    setForce,
    syncTime: settings.syncDiveComputerTime,
    setSyncTime: (sync) => update.mutate({ syncDiveComputerTime: sync }),

    status,
    outcome,
    running,
    canDownload: vendor !== '' && product !== '' && connection !== null && !running,
    downloadLabel: wentWrong ? t('download.retry') : t('download.download'),
    download,
    cancel: dcDownloadCancel,

    selected,
    toggle: (index) =>
      setSelected((current) => {
        const next = new Set(current);
        if (!next.delete(index)) {
          next.add(index);
        }
        return next;
      }),
    selectAll: () => setSelected(allOf(status)),
    selectNone: () => setSelected(new Set()),
    accepting: acceptDownload.isPending,
    accept,
    discard,
    shareLog,
  };
}

function allOf(status: DownloadStatus): ReadonlySet<number> {
  return new Set(status.dives.map((dive) => dive.index));
}

/** expo-file-system talks in file:// URIs, the core in plain paths. */
function pathOf(uri: string): string {
  return decodeURI(uri.replace(/^file:\/\//, '')).replace(/\/$/, '');
}
