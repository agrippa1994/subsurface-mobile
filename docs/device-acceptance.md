# Device acceptance

The manual pass that closes what a simulator cannot: gestures, the file picker,
navigation-bar buttons, scrolling below the fold, VoiceOver, and how a large log
feels. It is the evidence for the project's definition of done, item 4 ("a
dev-client build renders profile and statistics for a Suunto-imported log"), and
it replaces the TestFlight build task 12 originally asked for - the App Store
route is not pursued, see `release.md`.

Written to be re-run: after a core pin bump, after a native change, and again
for Android in task 13. Every row names the value to compare against, so a run
either matches or produces a finding.

## Preconditions

| Fact | Value |
| --- | --- |
| Build | `npx expo prebuild` then `npx expo run:ios --device` |
| Configuration | **Debug**. `__DEV__` must be true - the Developer section is the import route that needs no picker |
| Device | iPhone, iOS 26, Developer Mode on, paired and trusted |
| Host suite | `npm test` green and `SSRF_ASAN=1 npm test` clean before starting |
| Submodule pin | `e412ccb85` (`git submodule status`) |
| Core version | `6.0.5658` (`modules/ssrf-core/cpp/CORE_MANIFEST.md`) |
| Logbook | the bundled sample, restored via Settings > Logbook > "Restore the sample logbook" |
| Appearance | start in dark; section E flips it |

A Release build would hide Settings > Developer and force every import through
the picker. Do not use one for this pass.

## A. Launch and liquid glass

Closes task 01's acceptance on hardware. The liquid-glass spike screen was
removed before task 07 as that task instructed, so the check runs against the
shipping surfaces instead.

1. The app launches with the generated icon (`scripts/make-icons.mjs`,
   `assets/subsurface.icon`) and the splash, not the Expo template chevron.
2. The tab bar is the system glass material and list content scrolls *under* it.
   Four tabs: Dives, Sites, Statistics, Settings.
3. Settings renders as a real grouped SwiftUI `Form`; the dive list as a real
   inset-grouped `List` with native section headers.
4. Settings > Developer > "Load an empty logbook" gives the "No dives yet"
   `ContentUnavailableView` with a `glassProminent` action button
   (`src/components/status-view.ios.tsx`). Then Logbook > "Restore the sample
   logbook" brings the sample back.

## B. The bundled sample

Closes the task 04 gap: 18 dives parsed on device, not only on the host.

- Dives tab: **18 dives**, grouped into trips, newest first.
- Sites tab: **26 sites**.
- Settings > Logbook: Dives **18**, Dive sites **26**, and a footer showing the
  container path of `logbook.ssrf`.
- Open "Yellow House": **45.4 m** max depth, **37:40** duration, dive computer
  **Aeris A300CS**.
- Settings > Units > Imperial re-renders 45.4 m as **149 ft**; switch back.

## C. Import, all three routes

**C1 - developer actions** (no picker):

- "Import the Suunto sample" (bundled DM4 sqlite) adds one dive reading
  **22.4 m / 59:20 / 2 Feb 2013**.
- "Import the Suunto XML sample" runs through the XSLT stylesheets the module
  ships as a bundle - this is the on-device proof they were found. The alert
  reads `1 dive added. The logbook now holds N dives.`
- Run the XML sample **again**: it must report `1 dive already in the logbook`,
  not add a duplicate.

**C2 - the file picker** (never driven before; `use-transfer.ts:86-95`):

- Settings > Transfer > "Import dives" opens the document picker. A `.ssrf` in
  Files (iCloud Drive or On My iPhone) must be selectable, and so must a `.sde`
  and a `.db` - `IMPORT_DOCUMENT_TYPES` includes `public.data` for exactly that
  reason (`src/models/transfer.ts:18-24`).
- Pick a logbook: the "Import complete" alert names added and merged dives, and
  the counts on the screen go up.
- **Cancel** the picker: nothing happens, no alert, no busy row left disabled.
- "Open a logbook" asks first, with Cancel / Import / **Open** (destructive),
  and Open reports `N dives, M dive sites.`

**C3 - an incoming file** (AirDrop from the Mac, and Files > "Open in"):

- The app navigates to the **dive list** and the merge-or-open alert appears
  over it - not over a "page could not be found" screen (fixed in `ac80a89`).
- Choosing Import merges; choosing Open replaces.
- Afterwards `Documents/Inbox` is empty (visible in Finder > iPhone > Files >
  Subsurface, since `UIFileSharingEnabled` is set).

## D. Profile gestures

The task 08 gap - none of this could be driven in the simulator.

On a dive with a real profile (Yellow House, or the imported Suunto dive):

- **Pinch** zooms the time axis and the second under the focal point stays put.
- **Two-finger drag** pans; the axis labels follow.
- **One-finger drag** scrubs: crosshair on the depth curve, readout showing
  time, depth, temperature and tank pressure.
- **Double tap** resets to the whole dive.
- Record explicitly whether the scrub is ever stolen mid-drag by the enclosing
  vertical `ScrollView` (`src/app/(tabs)/dives/[id].tsx`). The scrub pan
  declares no `activeOffsetX`/`failOffsetY` (`src/components/profile-chart.tsx`),
  so this is the most likely real finding of the whole pass.

## E. Statistics in both appearances

The task 09 gap - dark was verified, light never was.

With the sample log and no filter: **18 dives**, **13 h 32 min** total, avg
**45:06**, **70 m** max depth, avg **17.8 m**, **12 dive sites**, and the
dives-per-year bars at 2010-2014 and 2020.

- Flip the system appearance (Control Center, long-press the brightness
  slider). The app is `userInterfaceStyle: 'automatic'`, so it follows.
- In **light**: the same numbers, bars and axis labels legible, tiles readable,
  no washed-out chart.
- Drag across a bar: the caption replaces the hint line.
- Apply a year filter and a site filter; the numbers recompute (they are
  recomputed in C++, not filtered in JS).

## F. Editing with the navigation-bar buttons

The task 10 gap - header buttons were unreachable in the simulator.

- Dive detail > **Edit** (headerRight): type a buddy, notes and tags, drag a
  rating star (haptic under the finger), move the dive to another site, then
  **Save** (headerRight).
- Sites tab > **New**: name plus a map marker, then **Save**. Saving with a
  blank name must be refused - a nameless site is dropped by the core on the
  next save (`core/divesite.cpp:155`).
- **Force-quit and relaunch**: every edit is still there and the counts are
  unchanged. This is the acceptance that the file is the source of truth.
- The keyboard does not hide the field being typed into; the list dismisses it
  on drag.
- Note if the dev-client's floating Tools button overlaps the header's Save
  button. That is a dev-build artifact only, not a shipping defect.

## G. Export

- Settings > Transfer > "Export and share" opens the share sheet; iOS names the
  file **"Subsurface logbook"** and it is `subsurface-YYYY-MM-DD.ssrf`.
- AirDrop it to the Mac. These are the artifacts `interop-check.md` consumes:
  export once with the untouched sample (**A1**), once after C1 (**A2**), once
  after F (**A3**).
- The working logbook is visible in Finder > iPhone > Files > Subsurface.

## H. Settings below the fold

The task 12 gap. Section order is Units, Logbook, Transfer, Problems, About,
Developer - so About and Problems need real scrolling, which is why they were
never seen.

- First force an entry: Developer > "Load a malformed logbook" (the error state
  appears and the failure is recorded).
- **Problems**: the summary reads `N entries, last on YYYY-MM-DD`. "Share the
  problem log" opens a share sheet with `subsurface-problems.txt`. With an empty
  log it instead alerts "Nothing to share". "Clear it" resets the summary to
  "No problems recorded".
- **About**: app version **1.0.0**, core version **6.0.5658**, core commit
  **e412ccb85**, the GPL-2.0 notice, and "Source code and licence" opening the
  repository in the browser.
- Nothing is clipped behind the glass tab bar; the last row of the last section
  is reachable. If it is not, the fix is a bottom content inset on the Settings
  `Host`, not a restructure.

## I. VoiceOver spot checks

Turn VoiceOver on (triple-click the side button if it is bound).

- A dive row reads as one sentence, with the duration spoken as "42 minutes",
  never as a clock time.
- The profile canvas reads its `profileSummary()` description as a single
  element - neither the curve nor the scrubber is reachable without a pointer.
- Statistics tiles and dive-detail rows each read as one element.
- The header Edit and Save buttons are reachable and announced as buttons.

## J. Large-log feel

Use the 600-dive logbook synthesized from `tests/harness/large-log.ts`
(~30 MB). AirDrop it and choose **Open**.

Record, as numbers rather than impressions: seconds from Open to the list
appearing, whether scrolling the Dives tab drops frames, seconds to open one
dive's profile, seconds for the Statistics tab. The host budgets for the same
data are in `tests/performance.test.ts` (parse 1.4 s, `listDives` 29 ms,
one profile 305 ms) - a phone will be slower; what matters is that the cost is
flat per dive.

If first render is bad, the cause is known: `src/components/dive-list-view.ios.tsx`
builds every row eagerly, and the portable variant already uses a virtualized
`SectionList`. Record it as a finding rather than fixing it mid-pass.

Then restore the sample logbook.

## K. Sign-off

| Run | Date | Build | Device / iOS | Result |
| --- | --- | --- | --- | --- |
| | | | | |

| Section | Pass | Notes |
| --- | --- | --- |
| A Launch and liquid glass | | |
| B Bundled sample | | |
| C1 Developer imports | | |
| C2 File picker | | |
| C3 Incoming file | | |
| D Profile gestures | | |
| E Statistics, light and dark | | |
| F Editing and header buttons | | |
| G Export | | |
| H Problems and About | | |
| I VoiceOver | | |
| J Large log | | |

Record the outcome in `tasks/PROGRESS.md` with the numbers actually seen, not a
bare "passed".
