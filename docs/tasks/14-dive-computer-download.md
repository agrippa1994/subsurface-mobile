# 14 — Downloading from a Dive Computer

**Goal:** Feature parity with the legacy Qt mobile app (`subsurface/mobile-widgets`): download
dives over Bluetooth LE, review them, merge the chosen ones into the logbook.

**Reference:** `mobile-widgets/qml/DownloadFromDiveComputer.qml`, `DownloadedDiveDelegate.qml`,
`core/libdivecomputer.cpp`, `core/qt-ble.cpp`, `core/btdiscovery.cpp`,
`qt-models/diveimportedmodel.cpp`.

## Design

- **Reuse the downloader.** `core/libdivecomputer.cpp` is compiled, behind one small patch
  (0008). Dive parsing, fingerprints and the incremental stop stay upstream's.
- **The transport is shared; only the radio is per platform.** `cpp/bindings/ble-stream.cpp`
  is libdivecomputer's iostream and holds everything that was in `qt-ble.cpp`. It talks to a
  `GattDriver` (`cpp/bindings/gatt-driver.h`): CoreBluetooth on iOS, BluetoothGatt on Android,
  a simulated dive computer on the host. Another transport (Android USB serial) would be
  another custom iostream beside it, plus a `transport` argument on `dcDownloadStart`.
- **The module owns the session.** A download goes into its own `divelog` on a thread of its
  own; the UI re-reads `dcDownloadStatus` when told to. Nothing reaches the logbook before
  `dcDownloadAccept`.

See `modules/ssrf-core/cpp/CORE_MANIFEST.md`, "The download path", for the pieces.

## Parity with the legacy app

| Legacy | Here |
| --- | --- |
| Vendor, product and connection pickers | Same, with a filter on the two long lists |
| BLE scan, rescan, detection from the name | Same tables; also libdivecomputer's filters, so Deep Six, Divesoft, Seac and Halcyon are found too |
| Four previously used computers, forget in Settings | Same |
| Progress, cancel, retry | Same. Cancel takes effect in the stream's next wait instead of the next timeout |
| Force all dives, sync time | Same |
| Review with select and unselect all, accept | Same, plus a warning when keeping part of an interrupted download |
| Incremental by fingerprint | The same code |
| Firmware update | Out of scope |
| USB serial, FTDI, Bluetooth classic (Android) | Out of scope |

## Acceptance criteria

- [x] libdivecomputer and the downloader compile for iOS (simulator and device), Android and
      the host, with no edit under `subsurface/`.
- [x] A full download from a simulated BLE dive computer through the real libdivecomputer
      backend: review, partial accept, save, reopen, incremental, force, failure, retry,
      cancel. `tests/dive-computer-download.test.ts`.
- [x] Clean under ThreadSanitizer: `build-host.sh --tsan`, then
      `SSRF_HOST_BINARY=.../build/tsan/ssrf-smoke vitest run tests/dive-computer-download.test.ts`.
- [x] The screen against the same simulation, on an iOS simulator: detection, download,
      progress, review, deselect, accept, written to disk.
- [ ] **A real dive computer on a real iPhone.**
- [ ] **A real dive computer on a real Android phone.**

## Not verified, and how to

No dive computer has been connected yet, and BLE does not exist in the iOS simulator. So
neither platform driver has ever run: not `ios/SsrfGattDriver.mm`, not
`SsrfGattDriver.kt`, and not the JNI path under it. The Heinrichs Weikamp credit
protocol has not run against anything either, the simulation is a Deep Six.

On a physical device, with a dive computer in transfer mode:

1. Dives tab, download button. The scan should find the computer and fill in the form.
2. Download. Expect progress, then the review list. On failure, Share the log:
   `libdivecomputer.log` has each GATT service found, the chosen one, and every packet.
3. Accept, check a profile, download again: "No new dives".
4. Force all dives: merges, without duplicates. Open the file in desktop Subsurface.
5. Cancel mid-download. Switch the computer off mid-download. Both must end, and Retry must work.
6. Download again after the phone has bonded: computers that stop advertising once bonded
   must still connect through "Previously used".

## Known limits

- The app must stay in the foreground: iOS suspends it and the link drops, with a failed
  download and a retry as the result. The screen is kept on during a download.
  `UIBackgroundModes: bluetooth-central` would fix it, and has to be justified to App Review.
- A dive computer hands out its newest dive first and the next download stops at the newest
  dive in the logbook, so older dives left out by an interrupted download, or unticked during
  review, are not offered again without "Force downloading all dives". This is how the
  legacy app works too; the screen warns about the interrupted case.
- On iOS a remembered computer's address only means something on this phone.
- `0007-suunto-json-without-fit` could now go, since `libdc_buffer_parser` is compiled. Not
  done here: it needs the FIT file pairing the importer lacks as well.
