# Progress

Update this checklist as tasks complete. A task is "done" only when its **Acceptance
criteria** pass. If blocked, leave it unchecked and add a note.

- [x] 00 — Overview & conventions read
- [~] 01 — Repo + Expo dev-client skeleton (code done; on-device build pending)
- [x] 02 — Native module scaffold (trivial JSI fn)
- [x] 03 — Vendor core subset + de-Qt shim compiles
- [x] 04 — iOS native deps link (libxml2/libxslt/sqlite3; libzip never needed, see 11)
- [x] 05 — JSI bridge + API implemented
- [x] 06 — TS models + vitest golden tests green
- [x] 07 — Navigation + dive list (read-only)
- [x] 08 — Dive detail + profile diagram (Skia)
- [x] 09 — Statistics screen
- [x] 10 — Editing: dives, dive sites, buddies
- [x] 11 — Suunto import + SSRF import/export
- [~] 12 — Polish + TestFlight beta (polish, robustness, release config done;
      TestFlight upload blocked on an Apple Developer account)
- [~] 13 — Android parity (own Compose UI, runs on an emulator; physical-device pass pending)
- [~] 14 — Dive computer download (done up to a real dive computer, which nobody has tried yet)

## Notes / blockers

- 2026-07-23 — Task 01: repo initialized (git, GPL-2.0 LICENSE, README, .gitignore).
  Expo SDK 57 app scaffolded (Expo Router, TS strict, src/ layout). Deps added:
  expo-dev-client, @expo/ui, @shopify/react-native-skia, expo-document-picker,
  expo-sharing, expo-file-system (all aligned to SDK 57 via `expo install --fix`).
  `subsurface/` added as a git submodule pinned at e412ccb85, URL = github origin.
  Dynamic `app.config.ts` created (replaces app.json): expo-dev-client plugin,
  iOS bundle id `org.subsurface.mobile`, deploymentTarget 26.0, `.ssrf`/`.xml`
  document types, native-module plugin slot for task 02. Liquid-glass spike at
  `src/app/_spike.tsx` (GlassView + @expo/ui Host/Button/List). `expo config`
  resolves clean.
  BLOCKED on-device acceptance: `npx expo prebuild` + `npx expo run:ios` onto a
  physical iOS 26 device (liquid glass + native module do not run in simulator /
  Expo Go) must be run on a Mac with Xcode + a device. Not executable here.
- 2026-08-11 — Task 02: local Expo module `modules/ssrf-core` created. C++ lives in
  `cpp/` (`ssrf::add`), reached from Swift through the Objective-C++ facade
  `ios/SsrfCoreBridge.{h,mm}`; Expo synchronous `Function("add")` dispatches over
  JSI. TS wrapper in `src/` (`index.ts`, `SsrfCoreModule.ts`, `SsrfCore.types.ts`);
  web variant throws. Verified on the iOS 26 simulator (Xcode 26.5): the home
  screen renders `add(2, 3) = 5` and the app console prints
  `[ssrf-core] C++ add(2, 3)` from the C++ side. `npx expo prebuild --clean` +
  `npx expo run:ios` succeed from scratch.
  Two build-plumbing findings worth remembering:
  1. CocoaPods file patterns must not escape the pod root, so the podspec sits at
     the module root (`modules/ssrf-core/SsrfCore.podspec`) to cover both `ios/`
     and `cpp/`. Expo autolinking only scans *subdirectories* for podspecs, so the
     root podspec must be declared via `apple.podspecPath` in
     `expo-module.config.json` - without it the pod builds but the module is not
     registered and JS fails with "Cannot find native module 'SsrfCore'".
  2. Pods build as framework targets here, so a Swift bridging header is rejected
     ("Using bridging headers with framework targets is unsupported"). Swift sees
     the Objective-C facade through the generated umbrella header instead; the
     C++ headers are kept out of it via `private_header_files`.
  Android still only has the generated Kotlin stub (no `add`); JNI parity is
  task 13.
</content>
- 2026-08-11 — Task 03: the Qt-free core subset compiles, links and runs. 37 core
  translation units are vendored out of the read-only submodule into
  `modules/ssrf-core/cpp/generated/` by `scripts/vendor-core.mjs` (copy → apply
  `patches/*.patch` → overlay `cpp/shim/override/`), driven by the Expo config
  plugin `plugin/withSsrfCore.js` before pod install. Four build-time patches and
  eleven replacement headers remove Qt; twelve shim translation units supply the
  symbols the core expects from qthelper/format/string-format/gettext/fulltext/
  filter/selection/git-access/platform. libdivecomputer is headers-only (the
  subset calls no `dc_*` function). Everything is documented in
  `cpp/CORE_MANIFEST.md`.
  `scripts/build-host.sh` compiles the identical tree for macOS in seconds and
  links `tests/main.cpp` — the iteration loop that made this tractable. Results:
  the serialization smoke unit produces valid SSRF XML, and all 89 logbooks in
  `subsurface/dives/` parse, with `abitofeverything.ssrf` reporting 18 dives
  (which is also task 04's acceptance number, already met on the host).
  Both smoke units are exposed to JS (`smokeSerializeMinimalLog`,
  `smokeCountDivesInFile`).
  BLOCKED on iOS: `expo prebuild` and pod install succeed, and the iOS build gets
  through everything except `#include <libxslt/transform.h>` — the iOS SDK ships
  `libxslt.tbd` but no libxslt headers. That is exactly task 04's scope; task 03
  is otherwise done.
  One trap worth remembering: an Xcode build phase re-reads the Expo config while
  compilation is running, so the config plugin runs mid-build. `vendor-core.mjs`
  therefore fingerprints its inputs and no-ops when unchanged, and materializes
  into a staging directory it renames into place - otherwise it deletes the tree
  underneath the compiler.
- 2026-08-11 — Task 04: libxslt is vendored and the iOS build is green. The iOS
  SDK ships `libxslt.tbd` but no libxslt headers, so the SDK copy is unusable;
  `modules/ssrf-core/ios/vendor/build/build-libxslt.sh` cross-compiles 1.1.43
  from source (device arm64 + simulator arm64/x86_64), merges libxslt+libexslt
  per slice and writes `ios/vendor/libxslt.xcframework` plus
  `ios/vendor/include`. libxml2, sqlite3 (needed by `import-suunto.cpp`) and
  zlib come from the SDK. libzip is deferred - nothing in the current subset
  includes `zip.h`; the zipped-format import path in task 11 ended up not
  needing it either (it decodes the container over zlib instead).
  `expo prebuild` + `expo run:ios` build clean and the app runs on the iOS 26
  simulator: the home screen reports `add(2, 3) = 5` and
  `459 bytes out, 1 dive(s) back` from a serialize -> write -> parse round trip
  through the vendored core.
  Three CocoaPods traps worth remembering:
  1. Headers attached to an xcframework (`-headers`) become *public* headers of
     the pod: they get flattened into `Pods/Headers/Public/SsrfCore` and
     `exslt.h` is pulled into the module umbrella, where `<libexslt/...>` no
     longer resolves. Ship the xcframework without headers and put them on
     HEADER_SEARCH_PATHS instead - and keep `ios/vendor` out of `source_files` /
     `public_header_files`, which is the same trap from the other direction.
  2. `vendored_frameworks` on a *static library* xcframework yields a bare
     `-lxslt-combined` with no search path. Link the slice by explicit path in
     OTHER_LDFLAGS, with `[sdk=iphoneos*]` / `[sdk=iphonesimulator*]` variants.
  3. Those flags must also go on `user_target_xcconfig` (the app performs the
     final link, and PODS_TARGET_SRCROOT does not exist there - use PODS_ROOT),
     and must keep `$(inherited)` or the whole Pods link breaks.
  The simulator slice needs x86_64 as well: a generic
  `platform=iOS Simulator` build compiles both architectures.
  Remaining gap: parsing `abitofeverything.ssrf` (18 dives) is verified on the
  host across all 89 logbooks, but not on device - that would need the fixture
  bundled as an app asset.
- 2026-08-14 — Task 05: the real module API is in, documented in
  `modules/ssrf-core/cpp/API.md`. `cpp/bindings/` holds it: `marshal.cpp` turns
  core structs into JSON in raw core units, `api.cpp` holds the dispatch table
  plus load/save/import/mutate. nlohmann/json 3.11.3 is vendored header-only at
  `cpp/third_party/` (MIT), reached through HEADER_SEARCH_PATHS rather than
  `source_files` - the same reasoning as libxslt's headers.
  Design decision worth keeping: **one** native function,
  `call(method, argsJson) -> json`, instead of one per API method. The
  Objective-C++/Swift glue is therefore method-agnostic and never changes again
  (nor will the JNI glue in task 13); adding a method touches `api.cpp` and
  `src/index.ts` only. Every reply is an envelope - `{ok, result}` or
  `{ok, error, errors}` - where `errors` carries whatever the core routed
  through `report_error()`, collected by a `set_error_cb` sink. `src/index.ts`
  turns a failure into a thrown `SsrfCoreError`.
  Methods: loadFromXML, saveToXML, clear, importSuunto, listDives, getDive,
  getProfile, getStatistics, listDiveSites, upsertDiveSite, deleteDiveSite,
  updateDive, getLastError. Buffers cross as base64; a path avoids the copy.
  saveToXML is atomic (`save_dives()` to `path.tmp`, then `rename(2)`).
  getStatistics implements its filter by marking dives `selected`, since that is
  the input `calculate_stats_selected()` / `calculate_stats_summary(true)` take.
  Acceptance, all on the host via `./scripts/build-host.sh` +
  `./build/host/ssrf-smoke api <file>`:
  `test29.xml` gives 4 dives with the first at `when=1323758100`
  (2011-12-13T06:35:00Z, matching `date='2011-12-13' time='06:35:00'`) and
  `maxDepthMm=20100` (20.1 m) - both as written in the file;
  profiles come back with monotonic `sec`, plausible depths and a pressure array
  of exactly `nr * nrCylinders`, verified non-zero across all 18 dives of
  `abitofeverything.ssrf` (e.g. 2342 samples x 2 cylinders = 4684 sensor
  readings); `listDiveSites` reports 26 sites, 17 with GPS.
  All 89 XML/SSRF logbooks in `subsurface/dives/` load through `loadFromXML`
  (the other 48 files there are CSV/sqlite/fit/binary formats this API
  deliberately rejects). Suunto import works on `TestDiveDM4.db` (1 dive) and
  `TestDiveDM5.db` (4 dives). A mutate -> saveToXML -> loadFromXML round trip
  preserves notes/buddy/tags/rating and a newly created dive site.
  Two traps worth remembering:
  1. `dive::id` is a *process-local* counter, not persisted. Ids differ after
     every load, so nothing may cache one across `loadFromXML`. Dive site
     `uuid`s, by contrast, are persisted and stable. Documented in API.md and in
     the TS doc comments.
  2. `tests/main.cpp`'s `call` subcommand takes several method/args pairs per
     invocation, because the divelog lives in the process - loading a file and
     then querying it has to happen in one process.
  Deliberately omitted from the profile JSON: `plot_data::ceilings[16]`,
  `percentages[16]` and `o2sensor[6]`. They would multiply the payload roughly
  30x and nothing in v1 draws them; see API.md if a later task needs them.
- 2026-08-14 — Task 06: `vitest` is green - 67 tests in ~2.5 s, run with
  `npm test` (plus `npm run typecheck`, `npm run lint`); CI in
  `.github/workflows/test.yml` on a macOS runner because the suite builds the
  real C++.
  Domain types live in `src/models/`. They are re-exported from
  `modules/ssrf-core/src/SsrfCore.types.ts` rather than restated: that file is
  the normative description of the bindings' JSON, so a hand-copied mirror would
  drift silently. `src/models/units.ts` holds the conversions and formatting,
  using the constants from `subsurface/core/units.h` so a depth in feet matches
  desktop to the digit.
  The harness drives the *real* bindings, not a TS reimplementation: a new
  `ssrf-smoke repl` subcommand speaks a line protocol
  (`<method>\t<args-json>` in, one envelope line out) and
  `tests/harness/ssrf-host.ts` wraps it method by method. One process per test
  file, since the divelog lives in the process. `tests/global-setup.ts` rebuilds
  the host binary before the suite, so tests can never pass against stale C++.
  Fixtures are referenced out of the submodule, never copied.
  Coverage: `tests/golden-parse.test.ts` (test29/test15/abitofeverything, values
  read off the XML source), `tests/round-trip.test.ts` (7 named fixtures plus a
  sweep over all 89 XML/SSRF files in `subsurface/dives/` - of the 137 files
  there the rest are CSV/sqlite/binary formats and never reach the parser; every
  one of the 89 is accepted and round-trips),
  `tests/profile.test.ts` (Suunto DM4/DM5 import + profile sanity),
  `src/models/units.test.ts`.
  Three bugs found and fixed - the round-trip test failed intermittently, and
  chasing that flake is what turned them up:
  1. **Use-after-free in the shim.** `cpp/shim/selection.cpp` kept
     `current_dive` as a raw pointer across `divelog::clear()`, which runs on
     every load, and `select_newest_visible_dive()` then wrote
     `selected = false` into freed memory. It landed inside whatever std::string
     had reused the block, so a random dive note came back with a NUL where a
     space had been - roughly one load in two. It now checks the dive is still
     in the log before touching it.
  2. **Upstream stack-buffer-overflow**, now carried as build-time patch
     `0005-profile-bound-o2-sensor-loop`. `fill_o2_values()` in `profile.cpp`
     keeps `pressure_t last_sensor[3]` but loops to `dc->no_o2sensors`, which is
     read straight out of the logbook and may be up to `MAX_O2_SENSORS` (6).
     `dives/Liberty_CCR_header_v1_00000011.dlf.xml` trips it through
     `getProfile`. Report upstream and drop the patch when the pin carries a fix.
  3. `getProfile` accepted any `dcIndex`, because `dive::get_dc()` clamps and
     wraps modulo the divecomputer count - an out-of-range index silently
     plotted a different divecomputer. `api.cpp` now range-checks it.
  Both memory bugs were found with `./scripts/build-host.sh --asan` (new flag,
  builds into `build/asan/`) driven over the whole fixture corpus. That sweep is
  checked in as `tests/asan-sweep.test.ts`, opt-in via `SSRF_ASAN=1 npm test`
  since it rebuilds the core. **Run it after any change to the shim, the
  bindings or the pin**: memory errors here surface as rare silent data
  corruption, not crashes, so the normal suite catches them only by luck. It is
  currently clean across all 89 logbooks (load, save, reload, every `getDive` +
  `getProfile`, statistics, and both Suunto imports).
  **Known limitation, upstream behaviour, not a shim defect.** The first save of
  a logbook authored elsewhere is not a no-op: `dive::fixup` completes what the
  file left open, exactly as desktop Subsurface does on its first save. Five
  such completions, enumerated and allowed in `tests/harness/parity.ts` and
  nowhere else:
  1. `divecomputer::when` is 0 when the file gives no per-computer timestamp;
     the writer emits the dive's date, so the reload has one.
  2. Dives with no samples get a fabricated profile (`fake_dc`, dive.cpp:1081)
     from max depth and duration; it is saved, and the reload recomputes mean
     depth off it (e.g. test15.xml 25.000 m -> 25.002 m).
  3. `sac` follows the recomputed profile (~0.04% on the affected files).
  4. A gas-switch event naming a cylinder whose mix contradicts the event's own
     o2/he attributes is rewritten to the cylinder's mix
     (test-tank-sensor-mapping-merge.xml).
  5. Whitespace around a text node is trimmed on the way back in.
  The invariant that actually protects user data therefore is: from the app's
  own output onwards the round trip is a fixed point - the second and third
  generations are model-identical and byte-identical. That holds for every file
  in `subsurface/dives/` the API accepts, and is what the sweep asserts.
- 2026-08-14 — Task 07: the app shell is real. Navigation is a root stack holding
  a native tab bar (`src/app/(tabs)/_layout.tsx`, liquid glass on iOS 26) with
  Dives / Sites / Statistics / Settings; each tab owns its own stack, so a dive
  pushes inside the Dives tab and keeps the tab bar
  (`(tabs)/dives/index.tsx` -> `(tabs)/dives/[id].tsx`). `src/app/index.tsx` is a
  redirect to `/dives`. The whole task-01/02 template - home, explore, the
  liquid-glass spike and their components - is gone, and with it the TS wrappers
  for the task 02/03 smoke units (the native functions stay).
  State is two small zustand stores. `src/store/log-store.ts` caches what
  `listDives()` / `listDiveSites()` returned plus the screen state around it
  (idle/loading/ready/error) - the module stays the source of truth and
  `refresh()` re-reads it wholesale after any mutation (task 10).
  `src/store/settings-store.ts` holds the metric/imperial setting in
  `documents/settings.json`; its shape and parsing live in
  `src/models/settings.ts` so they are testable in Node.
  The working logbook is `documents/logbook.ssrf`, seeded on first run from the
  bundled sample (`assets/sample/sample-log.ssrf`, a copy of the submodule's
  `abitofeverything.ssrf`, 18 dives / 26 sites). `metro.config.js` adds `ssrf` to
  `assetExts` so the file is a Metro asset; `src/lib/logbook-file.ts` resolves it
  through expo-asset and copies it into documents.
  Rendering is data-driven off `src/models/dive-list.ts`, which holds every
  formatting and grouping decision and is what the new vitest cases cover
  (99 tests total, still ~2.6 s). Trips are reconstructed from *runs* of
  time-adjacent dives sharing a trip location rather than by bucketing the
  string, because `listDives()` exposes a trip only through its location: two
  separate visits to the same place must stay two sections. Views come in two
  variants per screen - `*.ios.tsx` on SwiftUI (`List`/`Section`,
  `ContentUnavailableView`, `Form`+`Picker`) and a React Native fallback for
  Android (task 13) and web - both reading the same model.
  Verified on the iOS 26 simulator (dev client, `npx expo run:ios`): the sample
  log renders as a grouped native list newest-first; tapping "Yellow House"
  pushes the detail with the matching dive (45.4 m, 37:40, Aeris A300CS);
  switching the setting to imperial re-renders it as 149 ft; an empty logbook
  shows the "No dives yet" ContentUnavailableView and a malformed one the error
  state with a working "Try again"; deleting `logbook.ssrf` re-seeds the sample
  on the next launch.
  Two notes worth keeping:
  1. The core reports a failure twice - once as the envelope's `error` and once
     as a `report_error()` detail - and both carry the absolute sandbox path.
     `src/models/errors.ts` shortens paths to the file name and drops a detail
     that only restates the message; without that the error screen was a
     screenful of container UUID.
  2. Settings can be exercised without a device UI by writing
     `Documents/settings.json` / `Documents/logbook.ssrf` in the simulator
     container (`xcrun simctl get_app_container booted <bundle id> data`) and
     relaunching - which is how the empty, error and imperial states above were
     checked.
- 2026-08-14 — Task 08: the dive detail screen and the profile diagram are in.
  `src/models/profile-plot.ts` is the presentation model - it turns one
  `getProfile` reply into the drawn series (depth, deco ceiling, temperature,
  one line per cylinder), the axis ticks, and the scrubber readout, all in the
  core's raw units. It is covered by 20 vitest cases driven through the host
  harness: a Suunto DM4 import and every dive of the bundled sample, checking
  that the depth curve covers the profile, events stay inside the plotted range
  and sit on the curve, ceilings never exceed the dive depth, and the scrubber
  picks the nearest sample.
  `src/components/profile-chart.tsx` draws it with Skia; axis labels, the legend
  and the readout are React Native text on top of the canvas, so they inherit
  the platform font and Dynamic Type without shipping a font asset. Pinch zooms
  the time axis around the focal point, a two-finger drag pans, a one-finger
  drag scrubs, and a double tap resets. `src/app/(tabs)/dives/[id].tsx` is the
  full detail screen: header stats, the chart, dive/site/people rows, cylinders
  with gas mix and pressures, weights, dive computer and notes. That screen is
  React Native rather than SwiftUI because a SwiftUI list cannot host a Skia
  canvas.
  Colours follow the data-viz method rather than taste: three categorical slots
  (blue depth, orange temperature, aqua pressure) plus the fixed status colours
  for the deco ceiling and event markers, validated with the skill's script
  against this app's own surfaces, all pairs - light CVD dE 9.2 / normal 24.0,
  dark 9.4 / 20.9. Light-mode aqua is below 3:1 on white, so the relief rule
  applies and every series is named in the legend text. The palette and the
  command to re-validate it live in `src/constants/chart-theme.ts`.
  Verified on the iOS 26 simulator: the sample log's "Yellow House" dive renders
  depth, temperature, tank pressure, the deco-ceiling region and an event
  marker; tapping the chart puts the crosshair on the curve and the readout
  shows `17:18  24.5 m  5.6 C  115 bar`. A Suunto DM4 import (the bundled
  `assets/sample/suunto-sample.db`, imported through the developer action in
  Settings) lands as one more dive on device and lists as 22.4 m / 59:20 /
  2 Feb 2013 - exactly the numbers the core reports on the host.
  Four things worth remembering:
  1. `GestureDetector` needs a `GestureHandlerRootView` above it; without one the
     screen throws on render. It now wraps the whole app in
     `src/app/_layout.tsx`.
  2. The gesture callbacks use `.runOnJS(true)` and `.onChange` deltas rather
     than worklets and shared values. A zoom rebuilds the drawn paths, which is
     JS-side work anyway, and `windowPoints` thins each series to 600 points
     first - keeping the shallowest and deepest sample per bucket, so a spike
     survives the thinning that plain stride sampling would drop.
  3. `plotPressureAt` moved from `modules/ssrf-core/src/index.ts` into
     `SsrfCore.types.ts`: it is pure arithmetic over a reply, and the Node tests
     must import it without loading the native module.
  4. `plot_info::maxdepth` can exceed every plotted sample (it comes from the
     dive's own record, not from the interpolated samples), so the depth axis
     takes the maximum of both.
  Not verified on device: the profile rendered *from the imported Suunto dive*
  side by side with desktop Subsurface, and the pinch/pan gestures. Synthetic
  clicks into the simulator stopped landing partway through the session and
  neither a pinch nor a real desktop Subsurface run is available here; the same
  data path is covered numerically by `src/models/profile-plot.test.ts`.
- 2026-08-14 — Task 09: the statistics screen is in. Everything it shows is
  computed in C++: the core's `statistics.cpp` through
  `calculate_stats_summary()` / `calculate_stats_selected()`, plus three fields
  the bindings add in `extra_statistics()` (`api.cpp`) over the same selection -
  `timeline`, `byDuration` and `siteCount`. TypeScript only labels them, and a
  filter is re-sent to the module rather than applied to the rows in JS.
  Why those three exist:
  1. `timeline` is a per-(year, month) bucket that carries the year. The core's
     `stats_monthly` does group by year and month, but its `period` holds only
     the month, so a chart spanning several years cannot label its own bars.
  2. `byDuration` is a duration histogram, which the core has no equivalent of -
     10-minute buckets with an open-ended one at 180 min, matching desktop's
     default duration binner in `stats/statsvariables.cpp`.
  3. `siteCount` counts distinct sites by uuid. Counting them by name is wrong:
     `abitofeverything.ssrf` has two sites sharing a name, so names give 11
     where uuids give 12.
  `src/models/statistics.ts` is the presentation model (tiles, the two
  histograms, the dives-over-time series, the count axis and the filter
  conversion). Two decisions in it worth keeping: the time chart fills the
  months with no dives, because a gap in diving must not read as continuous
  activity, and it falls back to calendar years past a 24-month span, because a
  bar per month over a long logbook is unreadable on a phone. Depth buckets stay
  on the core's 10 m cuts in imperial too - the labels convert, the cuts cannot.
  `src/components/bar-chart.tsx` draws with Skia and puts the axis labels on top
  as React Native text, the same split the profile chart uses. Each chart is a
  single series (a count), so there is no legend and no categorical cycling:
  every bar wears the first categorical slot, added to
  `src/constants/chart-theme.ts` as `bar`/`barSelected` - the same hex as the
  profile's depth blue, so the palette validation from task 08 still stands.
  Touch replaces hover: dragging across the plot selects a bar and its caption
  replaces the hint line, and that caption is also the accessibility label, so
  the numbers are reachable without reading colour or geometry.
  Tests: 150 green (32 new). `src/models/statistics.test.ts` covers the pure
  model off a synthetic summary; `tests/statistics.test.ts` drives the real
  bindings and is the hand count the task asks for - 18 dives, 12 sites,
  totals and yearly split counted off `abitofeverything.ssrf` and cross-checked
  dive by dive against `listDives()`, plus year/site/empty filters and a
  single-dive logbook. The ASAN sweep is clean after the bindings change.
  Not verified yet: the screen on the iOS 26 simulator in light and dark. The
  rebuild that a native change forces was still running when this was
  committed - the numbers themselves are covered by the module-driven suite.
- 2026-08-14 — Task 09 follow-up: the statistics screen is now verified on the
  iOS 26 simulator (dark). It reports 18 dives, 13 h 32 min / avg 45:06, 70 m
  max / avg 17.8 m and 12 dive sites for the bundled sample, with the
  dives-per-year bars at 2010-2014 and 2020 - the same numbers
  `tests/statistics.test.ts` counts on the host. Light mode is still unchecked.
- 2026-08-14 — Task 10: editing is in, and every mutation lands in the SSRF file
  because that file is the source of truth. `src/store/log-store.ts` gained
  `updateDive` / `saveSite` / `deleteSite`, each of which applies the change in
  the module, re-reads the cache and schedules a save. The save is debounced by
  400 ms so a dragged rating does not re-serialize the logbook per frame, and
  `flush()` writes immediately - every editor calls it before it closes, and the
  store also flushes when the app leaves the foreground, so a force-quit cannot
  land inside the debounce window. A write that fails inside the debounce is
  re-thrown by `flush()` rather than left in the store as a message no screen
  shows.
  The two presentation models hold the decisions and are what vitest covers:
  `src/models/dive-edit.ts` (draft, minimal `DivePatch`, comma-separated
  buddy/diveguide lists, autocomplete harvested from the loaded log) and
  `src/models/site-edit.ts` (draft, minimal `DiveSiteInput`, coordinate parsing
  and formatting, duplicate and 100 m proximity detection). Both build the
  *smallest* patch that expresses the change, because `updateDive` and
  `upsertDiveSite` overwrite exactly the fields the argument mentions - echoing
  untouched fields back would resurrect stale values.
  Screens: `dives/edit/[id]` (site, buddies, rating, visibility, suit, tags,
  notes; the dive computer's own numbers stay read-only), a site picker modal
  that can create a site on the spot, and `sites/[uuid]` + `sites/new` sharing
  `features/sites/site-editor.tsx`. `expo-maps` was added for the map picker
  (Apple Maps on iOS; Android needs a Google key and waits for task 13, where
  the component degrades to the coordinate readout).
  Tests: 198 green, 48 new. `tests/editing.test.ts` is the acceptance evidence -
  it mutates, saves, and reloads the file in a *fresh host process*, which is
  what a force-quit and relaunch does. A new buddy, notes, rating, tags and a
  move to a newly created site with GPS all survive; every other dive and site
  is bit-identical afterwards; site create/edit/delete round-trips; deleting a
  site keeps its dives and detaches them; and the second and third generations
  of the app's own output stay a fixed point. The ASAN sweep is clean.
  One crash found and fixed, and it is the reason the app must never hand a
  stale id to the core: `dive_table::get_by_uniq_id()`
  (`core/divelist.cpp:757-765`) calls `exit(1)` on an unknown id in a DEBUG
  build. Dive ids are process-local and reassigned on every load, so a screen
  that outlived a reload passes one as a matter of course - and the app died
  instead of showing "not found". `require_dive()` in `api.cpp` now resolves the
  id itself; `tests/editing.test.ts` covers it (a regression takes the whole
  test file down with it, which is the point) and API.md documents the rule.
  Two upstream behaviours worth remembering:
  1. `dive_site::is_empty()` (`core/divesite.cpp:155`) plus `save-xml.cpp:661`
     drop a site that has no name, description, notes *and* no position. That is
     why `validateSiteDraft` refuses to save a site without a name: a site the
     app writes has to survive the next save.
  2. Moving a dive to another site decrements the old site's `diveCount`, which
     is correct and is asserted explicitly rather than filtered out.
  Verified on the iOS 26 simulator (dark): the sites list with its New button,
  the site editor with Apple Maps rendering the marker and the coordinate field
  seeded from it, the dive detail with its new Edit action, and a stale dive id
  showing "Dive not found - no dive with id 2" rather than killing the app.
  Not verified on device: typing into the editors and saving from the UI. Header
  buttons (Save, Edit, back) cannot be driven here - synthetic clicks reach the
  tab bar and the scroll views but not the iOS 26 navigation bar, and the
  dev-client's floating Tools button sits on top of the header's right side
  (dev builds only). That path is covered numerically by `tests/editing.test.ts`,
  which drives the same models and bindings the screens do.
- 2026-08-14 — Task 11: import and export are in, and one module method covers
  every format: `importFile` detects it from the file's *contents* - JSON, an
  sqlite DM4/DM5 database, a zip archive, or XML - and merges the result into
  the loaded log with `add_imported_dives(merge_all_trips)`, so importing the
  same file twice merges instead of duplicating. `loadFromXML` stays the
  "replace" path; the app offers both and asks before replacing.
  XML import needed one thing the module never had: the core reads every
  non-SSRF XML format by loading an XSLT stylesheet by name at runtime, and
  nobody had told it where they are. `vendor-core.mjs` now also copies
  `subsurface/xslt/` into `modules/ssrf-core/resources/xslt/`, the podspec ships
  it as the `SsrfCoreResources` bundle, and `SsrfCoreBridge.mm` calls the new
  `configure` method with the bundle path before the first call - from native
  code rather than from JS, so no screen can forget to.
  Four things upstream does not do for us, each deliberately placed:
  1. **Patch `0006-xslt-match-namespace-declaration`.** The stylesheet table
     picks SuuntoDM4.xslt on root `<Dive>` plus an `xmlns` *attribute*, tested
     with `xmlGetProp()` - but libxml2 keeps namespace declarations in `nsDef`,
     not in the property list, so that test never fires and a Suunto DM4 XML
     export parses to zero dives. Report upstream.
  2. **`cpp/bindings/suunto-xml.cpp`.** `SuuntoDM4.xslt` copies the dive's
     `ProfileBlob` / `TemperatureBlob` / `PressureBlob` into a `<blob>` element
     that no core parser reads - upstream only unpacks those columns from the
     *sqlite* DM4 database (`dm4_dive()`), so an XML export imports with a
     fabricated profile and no temperature or pressure at all. The four lines of
     layout knowledge (float32 m, uint8 C, int32 mbar, one per SampleInterval)
     are taken from that function; everything else still comes from the core.
  3. **`cpp/bindings/zip-reader.cpp`** for `.sde` / `.dld`: ~180 lines of
     read-only ZIP over zlib, instead of cross-compiling libzip (which neither
     the macOS nor the iOS SDK ships) for a container decode. `core/file.cpp` is
     still not compiled - the dispatch lives in `api.cpp`, and the dive data
     still goes through the core's own parser.
  4. **Patch `0007-suunto-json-without-fit`** plus Qt JSON stand-ins. The Suunto
     app's JSON export is read by `core/import-suunto-json.cpp`, ~700 lines of
     Suunto knowledge that must not be reimplemented - but it is written against
     QJsonDocument/QJsonObject/QJsonArray/QJsonValue. `cpp/shim/include/QJson*`
     provides exactly that surface over nlohmann::json, so the file compiles
     unchanged; the patch only removes the two parts that reach outside this
     build (the paired `.fit` file, which needs the libdivecomputer download
     path, and the desktop's multi-file pairing, which needs QFile and
     `readfile()`).
  One behaviour change in the bindings worth knowing: imported dives get their
  SAC, OTU and CNS computed (`update_cylinder_related_info`) before they are
  merged. Those are derived values that a file carries only because whoever
  wrote it had computed them; desktop does it in its dive-list model, which this
  module has no equivalent of.
  App side: `src/models/transfer.ts` holds the wording and the picker types,
  `src/features/transfer/use-transfer.ts` the OS plumbing (expo-document-picker,
  expo-sharing, the merge-or-open question), and the Settings screen gained an
  Import / Export / Open section. `src/store/log-store.ts` gained `importFile`,
  `replaceWith` and `exportTo`; an import writes the logbook immediately rather
  than waiting out the mutation debounce. Incoming files (Files, Mail, AirDrop)
  arrive as a URL and are handled above every screen by
  `use-incoming-files.ts`. `LSSupportsOpeningDocumentsInPlace` is deliberately
  *not* set: opening in place hands over a security-scoped URL and the core
  reads plain paths with `fopen()`, so iOS is left to drop a copy into
  `Documents/Inbox`, which the app reads and then deletes.
  Tests: 220 green, 22 new in `tests/import-export.test.ts`. The Suunto DM4 XML
  acceptance is there (177 samples, temperatures 26-28 C, pressures falling
  206520 -> 53870 mbar), and the four `suunto_*.json` fixtures are compared
  dive-for-dive against the `.xml` companion upstream ships next to them, which
  is the desktop importer's own output. Three match exactly; the Ocean nitrox
  file differs in seven fields, all downstream of the FIT file (gas mix, the
  gas-switch event, GF Low/High, and CNS/OTU which follow the gas) - they are
  listed in the test rather than filtered, so the day FIT support lands the test
  says so. The ASAN sweep now covers every import path and is clean.
  Verified on the iOS 26 simulator, driving files in through
  `xcrun simctl openurl` (which is also what the Files "Open in..." path does):
  a Suunto JSON lands as one dive dated 2026-01-13 with `otu='8' cns='5%'` -
  the same numbers the host reports; a `TestDiveDM3.SDE` archive imports through
  the zip reader and the bundled SuuntoSDM stylesheet; a DM4 XML export imports
  with its decoded profile and is written to `logbook.ssrf` as 179 `<sample>`
  elements carrying depth, temperature and pressure; re-importing it reports the
  dive as already present instead of duplicating it; and the Inbox copy is gone
  afterwards. Export puts a dated `subsurface-2026-08-14.ssrf` into the share
  sheet, where iOS names it "Subsurface logbook" - i.e. the UTI registration
  works.
  Not verified: opening an exported file in *desktop Subsurface* (not installed
  here), and the file picker itself, which cannot be driven from a script - the
  developer actions in Settings import the bundled samples through the same
  store path instead.

- 2026-08-16 — Task 12: polish, robustness and the release paperwork. Still open
  at the end of it: the TestFlight upload itself, which needs an Apple Developer
  account this machine does not have (see below).
  Robustness first, because the tests found real bugs rather than confirming the
  code. `loadFromXML` accepted any well-formed XML the core's table has no entry
  for and produced an empty logbook, so picking the wrong file in the Files
  picker silently replaced what the user was looking at; a parse that yields no
  dives, no sites and no trips is now a failure unless the document says it is a
  `<divelog>` (an empty SSRF is something the app itself can write). A load that
  failed *before* the parse - an empty file - left the previous divelog in
  memory while the store dropped its cache, so the two disagreed; the log is now
  cleared first and "load failed" always means "no dives". And an import left
  dives outside a trip that a reload of the same file would autogroup, so the
  app showed a different log than its own file did and the next save was not a
  fixed point; the import now runs `process_loaded_dives()`, the same
  post-processing a load does.
  (Superseded in part on 2026-08-16, below: autogrouping is off entirely, so
  neither path groups anything. The import still runs `process_loaded_dives()`
  for the rest of it - numbering, surface intervals, CNS, sorting.)
  `tests/robustness.test.ts` (13 tests) covers the malformed input - empty,
  truncated mid-dive, binary noise, a recipe file, an unclosed root, a missing
  path, a directory - and a stress session of 12 rounds of edit, site upsert,
  import and save, reloading the file in a fresh process after every round. It
  also asserts what the atomic write is for: no `.tmp` left behind, the file
  byte-identical when what was just loaded is saved again, and the logbook plus
  its mtime untouched when a save fails.
  `tests/performance.test.ts` drives a synthesized 600-dive logbook (real dives
  out of `SampleDivesV2.ssrf`, re-dated one per day, ~30 MB of samples). Host
  build, so the numbers are not a phone: parse 1.4 s, `listDives` 29 ms for the
  lot, grouping plus formatting every row 32 ms, one profile 305 ms end to end,
  statistics over the whole log under a second. What the test asserts is the
  *shape* - per-dive cost flat as the log grows, the summary carrying no
  samples, the drawn series thinned to 600 points however long the dive.
  Accessibility: the rows, the diagram and the tiles were built to be glanced
  at, which read out one fragment at a time is close to useless. `toDiveRow()`
  now also produces the sentence VoiceOver says (durations spoken as "42
  minutes", not "42:15", which iOS reads as a clock time), `profileSummary()`
  describes the shape of the dive since neither the curve nor the scrubber is
  reachable without a pointer, and the tiles and detail rows became single
  accessible elements. The chart palette needed nothing: it was validated in
  task 08 and every series is named in the legend.
  Crash reporting without a crash reporting service: a third-party SDK would
  mean someone else receiving a diver's data, and one more blob linked into a
  GPL-2.0 app. Failures land in a local log (`src/lib/diagnostics.ts`, newest 50
  entries, container paths stripped) that Settings can share or clear, fed by an
  `ErrorBoundary` in the root layout and by handlers for uncaught errors and
  unhandled rejections.
  Release: the app icon was still the Expo template's chevron.
  `scripts/make-icons.mjs` draws a dive profile and writes every raster from
  that one description - no image dependency, a PNG being a deflate stream in
  four chunks - plus an Icon Composer bundle carrying the same mark as SVG so
  iOS 26 renders it with its own material. `eas.json`, `docs/release.md` and
  `docs/store-listing.md` cover build, submit, listing copy and the privacy
  answers (nothing collected). The GPL-2.0 point that matters for the store: set
  a custom EULA to the GPL text, since Apple's standard one is more restrictive.
  Settings gained an About section naming the licence, the core version and the
  pinned commit, read from `CORE_MANIFEST.md` at config time.
  Haptics in three places only, per Apple's rule: a rating star under the
  finger, an import/open/export finishing or failing, and a destructive
  confirmation about to appear.
  BLOCKED: the TestFlight build. `eas.json` is complete except for the two
  account facts (`ascAppId`, `appleTeamId`), which need an Apple Developer
  Program membership and an App Store Connect record. The one thing to watch on
  a cloud build is that the core lives in a git submodule that has to be part of
  the upload; `vendor-core.mjs` now falls back to the pin in `CORE_MANIFEST.md`
  when the submodule arrives without its git metadata, but it cannot invent the
  sources.
  Verified on the iOS 26 simulator (iPhone 17 Pro), against a build made after
  `expo prebuild`: the app launches with the new icon and splash, the dive list
  and Settings render in dark mode with the liquid-glass tab bar, and a
  `TestDiveDM3.SDE` driven in with `xcrun simctl openurl` - the same path the
  Files "Open in..." uses - reports "1 dive already in the logbook. The logbook
  now holds 21 dives". That run found one bug the tests could not: Expo Router
  sees the incoming `file://` URL too, matches nothing, and left the import
  alert sitting on top of its "page could not be found" screen. The handler now
  sends the app to the dive list, and the alert appears over the list.
  Not verified on device: the About and Problems sections of Settings, which are
  below the fold - a script can drive URLs and launches but cannot scroll or tap
  the simulator (no idb here), the same limit noted for the file picker in task
  11. What the launch does prove is that `useSettingsScreen()` runs on device:
  it reads the problem log through expo-file-system and the pins through
  expo-constants while the screen renders, and the screen rendered.

- 2026-08-16 — Autogrouping turned off. Importing a logbook that declares no
  trips still produced trips, because `<autogroup state='1' />` latches: the
  flag was in `assets/sample/sample-log.ssrf`, the working logbook is seeded
  from that sample, `parse-xml.cpp` only ever sets it to true, `divelog::clear()`
  does not reset it, and `save-xml.cpp` writes it back on every save. Every
  `process_loaded_dives()` then grouped everything within three days
  (`TRIP_THRESHOLD`, `core/trip.cpp`). This app has no autogroup concept and no
  UI for one, so `disable_autogroup()` in `cpp/bindings/api.cpp` clears the flag
  after every parse - load, import (both logs) and `clear` - and the flag is
  gone from the sample. A trip now exists only because a file declares it.
  Consequence accepted: saving a logbook that carried the setting drops it, so
  desktop Subsurface loses that preference on reopen. Trips already autogenerated
  into someone's logbook stay; there is no migration.
  Follow-up the same day: a logbook the earlier build already saved keeps its
  autogenerated trips, and nothing can recognise them - `dive_trip::autogen` is
  in-memory only, absent from `save-xml.cpp` and from the parser, so after one
  save an autogenerated trip is indistinguishable from one made in desktop
  Subsurface. Dropping trips silently at load would therefore lose real ones on
  the next export. Instead there is a user-initiated `ungroupDives` (api.cpp),
  reached from Settings -> "Ungroup all dives" behind a destructive confirm that
  says it removes every trip. `notrip` is deliberately left unset, so no
  `tripflag='NOTRIP'` is written into a file desktop Subsurface would honour.

- 2026-08-16 — Async state moved to TanStack Query, forms to TanStack Form, and
  zustand dropped. The two stores were a hand-rolled query cache: `log-store.ts`
  carried its own `idle|loading|ready|error` machine, and three screens read the
  module inside a `useMemo` keyed on `[logPath, dives]` with
  `eslint-disable react-hooks/exhaustive-deps` to hide that the deps were
  invalidation keys rather than inputs. One of them was wrong -
  `dives/edit/[id].tsx` keyed on `[diveId]` alone, so the editor showed a stale
  dive if the log was reloaded underneath it. All of those disables are gone.

  What the shape is now: `src/queries/logbook.ts` holds the reads
  (`useLogbook`, `useDives`, `useSites`, `useDive`, `useProfile`,
  `useStatistics`), `src/queries/logbook-mutations.ts` the writes, and
  `src/queries/settings.ts` the preferences file. `src/lib/query-keys.ts` is the
  single key factory.

  Three invariants the migration had to carry, all of them easy to break later:

  1. **Dive ids are process-local.** Keys derived from the loaded log live under
     `['log','data']`. A mutation *invalidates* that subtree; a load, import or
     replace *removes* it and sets `['log']` directly, because invalidating the
     root would re-run `loadFromXML` and reassign every id underneath the screen
     that asked. `adoptLogbook()` in logbook-mutations.ts is the only place that
     does this.
  2. **Minimal patches.** TanStack Form submits full values, so
     `buildDivePatch` / `buildSiteInput` still diff against the dive or site the
     editor loaded. Echoing untouched fields back would resurrect stale values,
     since `updateDive` / `upsertDiveSite` overwrite exactly the fields named.
  3. **The `flush()` rethrow contract.** The 400 ms debounce moved out of the
     store into `src/lib/logbook-persist.ts`, unchanged in behaviour: a write
     that fails inside the window stashes the error and the next `flush()`
     rethrows it to the editor that called. `useSaving()` exposes the flag
     through `useSyncExternalStore`. The `AppState` background flush is now a
     hook with a real `remove()` cleanup instead of an import-time global
     subscription that was never unsubscribed.

  Query defaults are the opposite of the web ones (`src/lib/query-client.ts`):
  `networkMode: 'always'` - required, since there is no network and the default
  `'online'` would pause every query forever - plus `staleTime`/`gcTime` of
  `Infinity`, no retries and no refetch-on-anything. Every `queryFn` is
  synchronous, which is what makes `getStatistics` safe: it implements its filter
  by marking dives `selected`, and sync queryFns cannot interleave on the JS
  thread. Do not make them async without revisiting that.

  Forms: both editors are `useForm`. The validation and the patch building stay
  in `src/models/*` - `validateSiteDraft`, `parseCoordinates`,
  `validateCylinderDrafts`, `buildCylinderPatches` are called as validators and
  on submit rather than reimplemented, which is why the Node suite needed no
  changes at all. Site errors now render in the danger colour like the cylinder
  ones did (`FormField` gained an `error` prop distinct from `hint`), the
  cylinder use picker was promoted into `components/form.tsx` as `OptionField`,
  and both Save buttons disable while the mutation is pending - which they never
  did before.

  281 tests still pass, untouched; `tests/` and `src/models/` have no diff.

- 2026-08-16 — Dive deletion. The dive editor can now remove the dive it is
  editing: a destructive `Delete dive` row under Notes, an `Alert.alert`
  confirmation naming the dive (`diveRowTitle`), then `useDeleteDive`, `flush()`
  and `router.dismissTo('/dives')`. It dismisses rather than going back because
  the screen behind the editor is that dive's detail view, which would come up
  as "Dive not found".

  The path did not exist at any layer, so it is new all the way down:
  `delete_dive` in `cpp/bindings/api.cpp` (id to index, then
  `divelog::delete_single_dive()`, which detaches the trip and the site and
  drops a trip whose last dive this was), `deleteDive` in the module TS API and
  the vitest harness, and `useDeleteDive` in `src/queries/logbook-mutations.ts`.
  That mutation *removes* `queryKeys.dive(id)` and the new
  `queryKeys.diveProfiles(id)` prefix instead of invalidating them - nothing can
  answer for a deleted id, so a refetch would only come back as an error.

  Three cases in `tests/editing.test.ts`: the deletion survives a relaunch and
  leaves every other dive, the dive's site stays with its count one lower, and a
  trip disappears once its last dive is gone. 284 tests pass.

- 2026-08-17 — Fix: a dive imported from the share sheet was announced and then
  lost. Opening a file in the app at launch ("Open in Subsurface", AirDrop, a
  tapped attachment) reaches `useIncomingFileImports` as soon as the root layout
  mounts, which is also when the working logbook starts loading. The two raced
  on the one thing the module has: its divelog. When the import won, the merge
  went into an empty log, the save found no persist target - `persist()` returned
  quietly when `target === null` - and the initial `loadFromXML` then replaced
  the divelog with the file from disk. The alert said "Import complete" for dives
  that were in neither the list nor the file. The window is widest on a first
  launch, where `ensureLogbook()` has to copy the bundled sample out of the
  bundle before it can load anything.

  Two changes, one for each half:

  1. The load is now a shared `logbookQuery()` (`src/queries/logbook.ts`), and
     every mutation that touches the divelog waits for it first -
     `ensureLogbookLoaded()` in `useImportFile` (a failed load surfaces as
     "Import failed" rather than a merge into nothing), `settleLogbook()` in the
     load-shaped mutations, which do not need the content but must not be
     overtaken by a load still in flight. `ensureQueryData` dedupes, so this
     costs nothing once the logbook is open.
  2. `persist()` with no target is a save *failure* (`src/lib/logbook-persist.ts`)
     instead of a silent no-op, so a change that cannot reach the file can never
     again be reported as saved. `flush()` rethrows it, which is what the import
     alert reads.

  `src/lib/logbook-persist.test.ts` is new and covers the debounce and that
  guard against a mocked module; the C++ suite is unaffected.

- 2026-10-04 — Per-dive CSV export, matching desktop Subsurface's export dialog.
  The dive detail screen has an "Export as CSV" section with the dialog's three
  CSV flavours, each written by the core's own code and handed to the share
  sheet:

  - "Profile samples" - the samples as downloaded (desktop "CSV details",
    `xml2detailscsv.xslt`).
  - "Dive summary" - one row of dive information (desktop "CSV summary",
    `xml2summarycsv.xslt`).
  - "Computed profile" - the profile panel data (desktop "Profile data",
    `core/save-profiledata.cpp`, newly added to the compiled subset).

  New module method `exportDiveCSV` in `cpp/bindings/api.cpp`: the core writers
  only export "the selected dives", so it selects exactly the one dive first.
  The stylesheets follow the app's unit system, the computed profile the
  gradient factors the diagram uses (`apply_gradient_factors()`, factored out of
  `get_profile`). `tests/csv-export.test.ts` covers each format, that no other
  dive leaks in, the unit switch and argument validation; an ASAN run exporting
  every format for every dive of three fixture logs is clean.

- 2026-10-09 — Tools tab, with a nitrox calculator as its first tool. The tab
  lists the tools from `src/features/tools/tools.ts`, so the next one is a
  screen under `src/app/(tabs)/tools/` plus one entry there.

  The calculator takes the O2 percentage, the working pO2 limit (1.2-1.6),
  the planned depth and salt or fresh water, and shows the MOD at the working
  limit and at 1.6, the pO2 at depth, the best mix for the depth, and the
  no-decompression limit of a square dive on the mix beside the same limit on
  air. New module method `nitroxPlan` in `cpp/bindings/api.cpp`: the MOD is
  `dive::gas_mod()`, the best mix `dive::best_o2()`, and the NDL the loop
  `calculate_ndl_tts()` runs in `core/profile.cpp`, from surface-saturated
  tissues with the gradient factors from Settings. `tests/nitrox.test.ts`
  checks it against textbook MODs and a plain ZHL-16C air NDL;
  `src/models/nitrox.test.ts` covers the presentation. An ASAN run over a grid
  of depths and mixes is clean.

- 2026-10-10 — Git sync of the logbook over SSH. Settings has a "Git sync"
  section (status, "Sync now") and a screen of its own: the repository URL,
  branch, file path and commit author; the SSH key; "Commit and push" and
  "Pull"; the trusted host keys.

  New native module `modules/git-sync`: libgit2 1.9.7 with libssh2 1.11.1 on
  OpenSSL 3.5.9 (libcrypto only), cross-built into a static xcframework by
  `ios/vendor/build/build-libgit2.sh`, like libxslt. HTTPS is off. The
  Objective-C bridge (`ios/GitSyncBridge.m`) exposes git primitives on a bare
  repository in Application Support - fetch, push (fast-forward only), commit a
  file on top of a parent's tree, move a branch, extract a file, ahead/behind -
  and nothing is ever checked out: the logbook is committed straight from the
  app's own file.

  The sync itself is TypeScript (`src/lib/git/sync.ts`): fetch, flush and
  commit the working logbook, then push / take the server's file byte for byte
  (fast-forward) / merge. A merge is the core's import of the server's logbook
  into the loaded one, committed with both parents - SSRF is XML, which a line
  merge would wreck. The cost, stated on the screen: a dive deleted on one side
  and kept on the other comes back. A first sync against a repository with
  history merges into it rather than overwriting it; a device with an empty
  logbook simply takes the server's.

  Keys: generated as Ed25519 (CryptoKit supplies the seed, `src/models/git/
  ssh-key.ts` writes the OpenSSH file - checked against `ssh-keygen -y` in the
  tests) or imported from a file (OpenSSH or PEM, passphrase optional). The
  private key lives in the keychain, never on disk; the public key can be
  shared to add it to the git host. Host keys are trusted on first use: the
  first connection stops with the server's SHA256 fingerprint for the user to
  accept, and a changed key is refused with a warning.

  Verified: vitest for the models and the sync sequencing (fake repository);
  the bridge end to end in the simulator against a local sshd and a bare repo,
  with the fingerprint, mismatch, push, refused push, merge commit (checked
  with `git fsck` / `git log --graph` on the far side), fast-forward and
  extraction paths, and with encrypted Ed25519, RSA (PEM and OpenSSH, with and
  without passphrase) and ECDSA keys.

- 2026-10-11 — Task 13: the app builds and runs on Android, iOS unchanged.

  Native: `modules/ssrf-core/android` compiles the same `cpp/` tree as the
  podspec through CMake, behind a JNI facade (`src/main/cpp/ssrfcore-jni.cpp`)
  and a Kotlin module with the same `call(method, argsJson)` entry point.
  libxml2 2.13.8, libxslt 1.1.43 and SQLite 3.54.0 are cross-built by
  `android/vendor/build/build-deps.sh` (the NDK ships none of them) into static
  archives for `arm64-v8a` and `x86_64`; the app builds only those two ABIs
  (`expo-build-properties` `buildArchs`). The XSLT stylesheets ship as APK
  assets and are copied out once per process. `modules/git-sync/android` is the
  libgit2 bridge ported to C++/JNI (`git-sync-jni.cpp`), on libgit2 1.9.7 /
  libssh2 1.11.1 / OpenSSL 3.5.9 cross-built by
  `android/vendor/build/build-libgit2.sh`; the Ed25519 key comes from libcrypto
  (Android's own needs API 33).

  UI: SF Symbols are mapped to Material Symbols in `src/components/symbol.tsx`
  (tabs use `md=`); the navigation-bar action is `src/components/header-action`
  - Stack.Toolbar on iOS, a header-right button on Android, since Android's
  toolbar draws bitmap icons only. Settings on Android is rebuilt from the
  grouped form cards. "Open with" works through VIEW intent filters; the
  content:// file is copied into the cache under its display name by the new
  Android-only `copyContentUri`. The site map stays iOS-only (Apple Maps).

  Verified on a Pixel 9 Pro emulator (API 36, arm64): Suunto DM5 import
  (SQLite) and UDDF import (XSLT) through "Open with", dive list, profile,
  statistics, editor, sites, nitrox, settings; git sync against a local sshd -
  host-key prompt with the right fingerprint, commit and push (5 dives on the
  server), pull fast-forward of a server-side commit. vitest, typecheck and an
  iOS simulator build are green. Not yet done: a physical Android device and
  the golden tests on Android.

- 2026-10-24 — MCP server: an AI assistant on the local network can read the
  logbook while the user has it switched on in Settings.

  Native: `modules/http-server` is a plain HTTP/1.1 listener - Network.framework
  on iOS, a `ServerSocket` on Android - that hands each request to JS as an
  `onRequest` event and writes back what JS answers (`respond`). One request
  per connection, bodies up to 1 MiB, `Expect: 100-continue` honoured, a 504
  if JS takes over a minute. It also lists the device's IPv4 addresses, which
  `src/models/mcp/address.ts` labels (Wi-Fi, Ethernet, VPN - Tailscale
  included -, Hotspot, Cellular) and orders; Settings shows a URL with a copy
  button for every one of them, re-read every few seconds while it runs.

  Protocol (`src/models/mcp/protocol.ts`): MCP's Streamable HTTP transport at
  `/mcp`, stateless - POST with a JSON reply, 202 for notifications, 405 for
  GET/DELETE, protocol versions 2024-11-05 through 2025-11-25. No
  authentication, as asked; what is checked is what keeps a web page out
  (a foreign `Origin` is refused, only `application/json` is accepted, so a
  cross-origin page needs a preflight the server never approves).

  Tools (`src/models/mcp/tools.ts`), all read-only: `list_dives` (filters,
  paging), `get_dive` (notes, cylinders, weights, conditions, site, dive
  computers and events; by id or by dive number), `get_statistics` (the core's
  statistics.cpp, by year / month / trip / mode / depth / temperature /
  duration), `list_dive_sites` and `export_dive_csv` - the computed profile by
  default (save-profiledata.cpp, at the app's gradient factors unless given),
  or the details / summary CSV. Each argument is declared once
  (`src/models/mcp/args.ts`), which yields both the published JSON Schema and
  the check a call goes through; `list_dives` filters with the same predicate
  as the bindings' `apply_stats_filter`, so a list and the statistics for one
  filter count the same dives. Replies (`src/models/mcp/format.ts`) are metric
  with the unit in the key, converted by `src/models/units.ts`; unknown values
  are null rather than the core's 0.

  The server is never started by itself: not at launch, not from a saved
  preference. Its state is one value (`off` / `starting` / `running` /
  `interrupted`, src/lib/mcp/server.ts); when iOS takes the socket while the
  app is suspended it is `interrupted`, still switched on, and listens again
  on the return to the foreground.

  Verified: vitest - the protocol against a stub, the tools through the host
  binary against `abitofeverything.ssrf` (counts, filters, paging, unit
  conversion and the profile CSV checked against what the core returns).

- 2026-11-05 — Task 14: downloading from a dive computer over BLE, lifting the "no
  libdivecomputer, no BLE" exclusion. See `14-dive-computer-download.md`.

  libdivecomputer is built from source now, from its Makefile.am list, and
  `core/libdivecomputer.cpp` goes in behind patch 0008. `ble-stream.cpp` replaces the Qt
  transport and is shared; `GattDriver` is the seam, implemented on CoreBluetooth and on
  BluetoothGatt, so Android came along (no USB serial). The screen follows the legacy one:
  pickers, detection, previously used computers, progress, cancel, retry, force, sync time,
  review, accept.

  Verified: vitest against a simulated Deep Six Excursion behind the driver seam, speaking
  the real protocol, so libdivecomputer's own device and parser backends run (37 tests);
  the same under ThreadSanitizer and AddressSanitizer; the iOS app building for simulator and
  device; the screen driven against the simulation on a throwaway iOS simulator, which found a
  re-subscribe on every render that the host tests could not. On Android the app builds, and on
  a Pixel 9 Pro emulator it loads, opens the screen, asks for the permission and starts a scan
  without a crash; no download ran there.

  **Not verified: anything on a real dive computer.** The iOS and Android drivers have never
  talked to a radio, and the Heinrichs Weikamp credit protocol has never run. The task file
  says how to check.

  Follow-ups: firmware update; Android USB serial and Bluetooth classic (a custom iostream
  each, and a transport argument); background downloads on iOS (`bluetooth-central`); the
  Pelagic i330R and DSX access code, which the legacy app does not do either.

- 2026-11-05 - SSI logbook download: Settings, SSI, Logbook can add the SSI dives
  to the working logbook or save the whole SSI logbook as a `.ssrf` file.
  `src/models/ssi/ssrf-import.ts` turns a raw `get_divelog` body into SSRF XML that
  goes through the core's own `importFile`, so nothing under `subsurface/` changed.

  Mapped: samples (depth, temperature, tank pressure, NDL, deco state and stop, TTS,
  CNS, heart rate, bearing, setpoint), alarms as events, cylinders including the
  tech and rebreather families, max and mean depth, duration, water and air
  temperature, salinity, weight, rating, surface interval, buddies, dive guide,
  site with position and country, dive computer with serial and firmware. Set GF,
  end GF and SSI's CNS and OTU are extra data ("GF Low" and "GF High" are the keys
  the core's own importers use). Labels, wildlife, gear, visibility and dive center
  go in the notes, because SSRF has no field for them.

  Not representable: SSI's per-sample GF curves (`gn`, `gs`), which the core derives
  from the tissue model, using the app's GF setting rather than the dive's. Battery,
  speed and sample location have no SSRF slot and are dropped.

  A dive the log already has is skipped, by the same test as the core's
  `dive::likely_same`. A core merge would file SSI's 5-second copy as a second dive
  computer on a dive that already has the original download.

  Verified: vitest through the host binary (`tests/ssi-ssrf.test.ts`), and locally
  with two real SSI records against the desktop download of the same dives: same
  max depth, mean depth, duration, and alarm times. Not verified: a live SSI account,
  or the screen on a device. Free-dive and rebreather mappings have no real record
  behind them.

  Follow-up: "Add SSI dives" opens its own page (`src/features/ssi/ssi-import-screen.tsx`).
  It lists the SSI dives with the ones already in the log marked, imports the ticked
  ones, or replaces the log with all of them after a confirmation that counts the dives
  not on SSI. A replace refuses a response with no dives, because an empty logbook
  loads without error and would wipe the log.

- **Android maps**: `src/components/platform-map.tsx` draws MapLibre with OpenFreeMap
  tiles (no key, no account); `platform-map.ios.tsx` keeps Apple Maps. MapLibre is left
  out of the iOS build (`react-native.config.js`) and `expo-maps` out of the Android one
  (`expo.autolinking` in `package.json`). Zoom levels stay in the app's 256 px units and
  are converted in the component. OpenFreeMap has no SLA.

- 2026-11-06 — Trip management, closing the gap with the legacy mobile app:
  create a trip from dives, add to any trip (the ones above and below as well as
  through a picker), remove from a trip, and view and edit a trip's location and
  notes.

  Native: `listTrips`, `createTrip`, `addDivesToTrip`, `removeDivesFromTrip` and
  `updateTrip`, a `tripId` on every dive, and a `tripId` statistics filter so a
  trip's totals come from statistics.cpp. The Qt undo commands are not in this
  build, so the methods repeat what those commands do through the same core
  functions: a trip goes away with its last dive, and a removed dive gets
  `notrip`, written as `tripflag='NOTRIP'`, so desktop does not autogroup it.
  `core/triptable.cpp` joined the vendored subset.

  The list now groups by trip id. Grouping by location string merged neighbouring
  trips of one place and showed a trip without a location as "Not in a trip". A
  trip gets one section even when other dives lie between its own, which the
  picker makes possible.

  UI: a trip's section header opens it; a dive row offers the trip actions on a
  leading swipe and on long press; dive detail has a Trip section. Trip detail
  has summary, notes, dives and Ungroup. The picker is a sheet, nearest trip
  first, with search. "Select" in the list marks several dives for a new trip, a
  move or removal; on iOS the actions are a navigation bar menu, because a bottom
  toolbar sits behind the floating tab bar. A selection ends when the log changes.
  Moving a dive needs no confirmation unless it ends a trip that has a location or
  notes; Ungroup always asks. The "Ungroup all dives" button stays in Settings: it
  is the logbook-wide cleanup for trips an autogrouping build wrote, which a
  per-trip action does not replace.

  Verified: vitest, including `tests/trips.test.ts` (bindings through the host
  binary, SSRF round trips, a sweep over the `subsurface/dives/` fixtures) and
  `src/models/trips.test.ts`; lint and typecheck. On an iOS 27 simulator of its
  own, in light and dark: list, context menus, swipe, selection, picker, trip
  detail, editor, ungroup, the Sites stack and a 186-dive log. Not verified: the
  portable variants on Android, and opening an exported file in desktop Subsurface
  (the XML is written by the core's own save-xml.cpp and read back by its parser).

  Follow-ups: merging two trips, and adding dives from the trip screen.

- 2026-11-06 - **Several dive computers per dive**: the dive detail screen can switch
  between a dive's computers, which closes the prev.DC and next DC gap with
  `subsurface/mobile-widgets/qml/DiveDetailsView.qml`. A dive with one computer shows no
  new control and no new row. `src/models/dive-computers.ts` holds the presentation logic,
  `src/features/dives/computer-picker.ios.tsx` a SwiftUI menu, and
  `src/features/dives/computer-picker.tsx` the portable row. No native code or core file
  changed, so `CORE_MANIFEST.md` stays as it was.

  A menu rather than a segmented control, because names run past 25 characters and a dive
  can have any number of computers. The picker sits in the Profile card and beside the
  title of the landscape profile.

  Per computer, following the selection: profile, events, the chart's maximum depth and
  total time, and the Dive computer section (model, serial, firmware, samples, mode, max
  and average depth, duration, water and air temperature). `PlotInfo.maxDepthMm` and
  `maxtimeSec` are not per computer in the core, so `plotForComputer` replaces them. Mode
  leaves Details on these dives, because the summary's mode is only the first computer's.

  Per dive, unchanged: the header figures and Details, which a footer says cover the whole
  dive, plus cylinders and weights. Two features still read the first computer only: CSV
  export and the SSI upload. Both sections say so on these dives.

  The profile is fetched before the selection moves, because the query is keyed on the
  computer: otherwise the screen drops to its loading state and the landscape modal closes.
  The selection is tied to the dive id and falls back to the first computer when out of
  range, since `getProfile` rejects an index past the end.

  Verified: vitest, including `tests/multi-computer.test.ts` through the host binary on
  dive 224 of `abitofeverything.ssrf`; lint and typecheck. On a throwaway iOS 27 simulator
  with that fixture as its logbook, on dive 333: switching in portrait and in landscape,
  light and dark, the selection returning to the first computer on reopening, the footers,
  and dive 334 (one computer) with no picker and Mode still under Details.

  Not verified: the Android picker has only been typechecked and linted, never run. The
  accessibility label and value were read from the accessibility tree, not heard with
  VoiceOver. No fixture name is long enough to show truncation on screen. The fallback when
  a dive loses its selected computer is covered by a unit test only, because nothing in the
  app can remove a computer yet. A dive with several computers of the same model was not
  seen on screen; its labels are unit tested.

  Follow-ups, left out because legacy mobile does not have them and each rewrites the log
  with no undo in the app: make a computer the first (`clone_make_first_dc`), delete one
  (`dive_table::clone_delete_divecomputer`), split one off into its own dive
  (`dive_table::split_divecomputer`). Making one the first is the cheapest and the most
  useful, since it decides what CSV export and SSI upload read. Also: let CSV export and SSI
  upload follow the selected computer.

- **Merging dives**: a long press on a dive row offers "Merge with Next Dive" or "Merge
  with Previous Dive", and dive detail has a Merge section, both only for a pair the core
  would merge. A confirmation names both dives and says what happens to the site, the trip
  and later dive numbers, from the core's own preview. There is no undo. From the list the
  user stays on the list; a detail screen open on a source dive, in either tab's stack,
  moves on to the merged dive (`src/lib/merged-dives.ts`).

  `mergeDives` in `cpp/bindings/api.cpp` repeats the desktop's `MergeDives` command around
  `dive_table::merge_dives()`. The rule is the legacy mobile app's `canMerge`: neighbours
  at most 30 minutes apart, with no "merge anyway" as on the desktop. Two differences from
  the command, both deliberate: sample pressures and SAC are worked out again, because the
  command leaves the first dive's in memory until the next load, and a dive naming a
  cylinder it does not have is refused.

  Two out-of-bounds reads in the core turned up under AddressSanitizer. `merge_samples()`
  read before the cylinder map on an ordinary sample with no sensor, and could write the
  value read into the sample: fixed by build patch 0009, worth sending upstream.
  `event_renumber()` and `dc_tank_sensor_mappings_renumber()` read past it for a cylinder
  the dive does not have (`dives/test-tank-sensor-mapping-merge.xml` holds one): that is the
  refusal above. The legacy app and the desktop have both.

  Verified: `tests/merge-dives.test.ts` through the host binary, also under AddressSanitizer
  (overlapping dives, surface intervals, refusals, trips, sites, numbering, SSRF round trip,
  and one merge from every fixture that offers one); model tests. On a throwaway iOS
  simulator with a synthetic logbook, in light and dark mode: the menu, cancel, merging from
  the list and from detail, the saved file, a stale detail screen in the Sites tab. That run
  found the React Compiler memoizing the id lookup, hence the store.

  Not verified: opening a merged file in desktop Subsurface (only this build's own copy of
  its parser read it back); the Android long-press menu and the merge on Android, which
  were typechecked but neither built nor run; a real logbook. On the simulator, the trip lines of the question
  were not seen, and neither was a merge of dives from two dive computers: both are covered
  by tests only. The patched core was built for the iOS simulator and the host, not for an
  iOS device or Android.

  Not done: merging from selection mode or from a trip's dive list. The binding takes more
  than two dives, and the UI offers two.

- 2026-11-06 - Dive planner and gas calculator (task 15, `docs/tasks/15-dive-planner.md`).
  `planDive`, `savePlan`, `gasInfo`, `plannerOptions` and `plannerSurface` in
  `cpp/bindings/planner.cpp` do around the core's `plan()` what the Qt model does.
  Tools has a planner, with a settings screen covering the legacy setup page, plan notes
  drawn natively, and a gas calculator. A plan saved to the log is a `planned dive`,
  which the list and the dive screen say, and it offers no SSI upload.

  Verified: `tests/planner.test.ts` holds `testplan.cpp`'s plans through the bindings,
  with its minimum gas, gas change depths and known runtimes exact, also under
  AddressSanitizer. On an iOS 27 iPhone 18 Pro simulator of its own, against a copy of
  `abitofeverything.ssrf` with two dives moved close enough to merge, in light and dark:
  default plan, depth and time steppers, cylinder sheet, EAN50 deco gas, stops, gas used
  against carried, profile, notes, settings, VPM-B, CCR, the bailout error with no plan
  and saving disabled, overlap warning, landscape panes, saving a plan and a relaunch.
  Testing on the simulator found what the unit tests could not: a warning appearing
  above the form moved the steppers under the thumb, a chart in a SwiftUI row took no
  width, the chart kept the zoom of an older plan, a vertical drag on the chart scrubbed
  instead of scrolling, and a tank's 232 bar read as 230.

  The same run covered tasks of main's: several dive computers per dive (dive 224: the
  picker, each computer's own profile and events) and merging (from the dive screen and
  from a long press in the list: confirmation, the screen moving on to the merged dive,
  renumbering in the saved file, and surviving the relaunch).

  **Not verified: anything on a real device, and the portable screens.** `planner.tsx`,
  `planner-cylinder.tsx`, `planner-settings.tsx` and `gas.tsx` typecheck and share their
  logic with iOS, but have not been run on Android. No plan has been compared with
  desktop Subsurface side by side, beyond what `testplan.cpp` pins, nor has a saved plan
  been opened in desktop Subsurface. pSCR ran through the host binary only, not on
  screen, and the imperial screens were not looked at. Dynamic Type, VoiceOver itself
  (labels were read through the accessibility tree, not spoken) and the time a plan
  takes on a phone were not measured; timings are from the `-O0` macOS host binary.

  Follow-ups: statistics count planned dives, as desktop does, which a diver may not
  expect; patch 0010 should go upstream.

- 2026-11-06 - Undo and redo for the logbook.

  **Architecture: whole states of the log, not inverse commands.** A state is the XML the
  log would be saved as, kept in `cpp/bindings/history.cpp`, which wraps the dispatch in
  `api.cpp`. Inverse commands (legacy's `commands/`, on Qt) are finer-grained, but need an
  inverse for every mutation, written again for each one to come, and a forgotten field in
  one is silent corruption. A state cannot drift from the core: whatever the file keeps,
  it keeps. Anything not listed as a read counts as a change, and leaves an entry if the
  log serializes differently afterwards, so a new mutation has undo with no code, an edit
  that changes nothing leaves no entry, and a mutation that throws half way can be undone.

  What it costs, on `subsurface.xml` (6.8 MB, 186 dives), macOS host at `-O0`, so a phone
  will differ: an edit took 72 ms, of which one extra serialization is about 47 ms, and the
  first change of a session, which serializes twice, 154 ms; an undo is a parse and a
  serialization, 468 ms in all, which blocks the JS thread as a load does. Memory: states share chunks cut at each
  dive, site and trip, and 50 edits to 50 dives hold 8.09 MB, where full copies would be
  340 MB. Capped at 50 entries and 64 MB, keeping at least one entry. A mutation that
  renumbers every dive shares nothing and costs a whole log; the 64 MB cap then leaves
  about nine entries on this log.

  Ids: a parse hands out new dive and trip ids, so a state keeps each dive's ids, and a
  restore puts them back by `when` and number. A restored dive has its old id, so open
  screens and cached queries stay right with no mapping. `idsKept: false` would make the
  app reset the cache instead; no test has produced it. New ids cannot collide, since the
  core's only count up. The React Query cache re-reads what is watched and drops the rest:
  nothing refetches on mount here, and a cached failure would outlive the dive's return
  (found on the simulator).

  A save straight after an undo writes the restored bytes rather than serializing again.
  The first parse of a file the core did not write can round a derived figure differently
  (`tests/round-trip.test.ts` says as much), and an undo must give back the very file.

  Patch 0011 removes `static` from `save_dives_buffer`, so that a state needs no temporary
  file. `CORE_MANIFEST.md` has it.

  **What is undoable, and the boundaries.**
  - Undoable: edit, delete and merge dives; add, edit and delete sites; every trip
    operation; ungroup all; import a file, including SSI; accept a download; save a plan.
    A download undone is not lost for good: the stored fingerprint names a dive the log no
    longer has, so the next download fetches it (tested).
  - Clears the history: opening a logbook, SSI's replace, and any other `loadFromXML`, also
    a failed one, since the states are of a log no longer there. Their warnings stay, and
    Open now says it cannot be undone.
  - Git sync: a sync that brought changes in clears the history (a merge through
    `clearHistory`, taking the server's logbook through `loadFromXML`), so an undo cannot
    overwrite what arrived. A sync with nothing to bring in leaves it: an undo afterwards
    is a new local change, for the next sync to commit. Undo refuses while a sync runs,
    because a sync writes the server's file and then reloads it. An undo schedules and
    flushes a save like any mutation, so a sync sees the undone state.
  - History does not survive a restart. The menu is simply absent then.

  **UX.** A toast (`src/features/history/undo-toast.tsx`) follows every change, with Undo;
  after an undo it offers Redo. It listens to the history, reported on the envelope of any
  call that changed it, so a new mutation gets it unasked. Five seconds, twelve with a
  screen reader, swipe down to dismiss, announced to VoiceOver, its button labelled in
  full. It sits in a `FullWindowOverlay`, on tinted liquid glass. Header menu on the dive
  list, dive, trip and site screens, naming the action; on iOS also inside the Sites
  list's options menu. Android has an icon opening an alert. Haptics through
  `src/lib/haptics.ts`. The screen an editor's delete closed reopens on undo; a screen
  whose dive, trip or site was undone away goes back once it is in front; an editor's
  draft is rebuilt after an undo, or Save would put back what was undone.

  Shake to undo was not added, and not tried. iOS offers it through `NSUndoManager` and the
  responder chain, which would need native code mirroring this history; the alternative is
  reading the accelerometer, which is what fights the platform. In a dev client the shake
  also opens the dev menu, so it could not have been checked there.

  **Confirmations changed.**
  - Removed, because the action undoes: delete dive (swipe, long press, editor), delete
    site, moving the last dive out of a trip with a location or notes (`tripLossWarning`
    and `tripsEmptiedBy` went with it), ungroup one trip, add a plan to the log.
  - Removed as alerts, because the toast reports them: import, download and SSI import
    that went plainly. One that added nothing or left something out still gets its alert.
  - Kept, changed: merge is no longer destructive in style or haptic, and no longer says
    it cannot be undone. It stays because it says what will happen to numbers, sites and
    trips, which shows nowhere else. Ungroup all trips stays, since it reaches over the
    whole log from a screen that shows none of it, and now says it undoes.
  - Kept: Open logbook, incoming file (both now state it cannot be undone), replace with
    SSI, discard downloaded dives, git and SSI account actions.

  **Parallel work.** Trip management, merging, several dive computers and the planner are
  all in this branch's base, and those branches add no method beyond it. Nothing they need
  to do. A later mutation needs nothing for undo; a case in `describe()` and in
  `src/models/logbook-history.ts` gives it a label instead of "Change to the Logbook".

  Verified: `tests/undo-redo.test.ts` through the host binary, also under AddressSanitizer:
  undo and redo of each mutation against the saved file byte for byte, id survival, the
  redo-cleared rule, the depth cap, cleared history on load, memory on `subsurface.xml`,
  reads leaving the file alone, and delete, undo and redo on every loadable logbook in
  `subsurface/dives/`. A download in `tests/dive-computer-download.test.ts`. Model tests
  for labels and toasts, `src/lib/logbook-history.test.ts` for persistence and the sync
  hold, `merged-dives.test.ts` for following a merge back and forth. vitest, lint and
  typecheck. On a throwaway iOS 27 simulator with a copy of `abitofeverything.ssrf`, since
  deleted, in light and dark: delete from the editor with toast, menu, undo reopening the
  dive, redo leaving its screen; the file on disk after each. A second undo after that
  found the stale cached failure above; its fix is covered by a unit test, and was seen on
  screen only through a relaunch and the site delete, not by repeating those steps. Merge
  from the dive screen and its undo, with the file byte-identical and the screen moving to
  the first source. Delete site with dives and undo through the Sites menu, byte-identical.
  Remove from trip without a warning and undo, byte-identical. A relaunch keeping the log
  with no menu. The toast in landscape over the fullscreen profile.

  **Not verified.** Anything on a real device, including how long an undo blocks there, and
  haptics, which a simulator does not produce. Android: the portable surface, header button
  and alert typecheck but have not been built or run. VoiceOver speaking the announcement
  (the accessibility tree was read, not heard). Reduce Motion. Swipe to dismiss was only
  flung once, and the toast being gone a second later is the evidence. Deleting from a list
  swipe or long press: the simulator driver's gestures did not land, so that path was only
  typechecked, though it shares its mutation with the editor. On screen, not tried: undoing
  an import, a download, a saved plan, or anything around a real git sync; the sync's
  `clearHistory` and hold are covered at the bindings and in `logbook-history.test.ts`, not
  through `useGitSync`. Opening the undone file in desktop Subsurface.

  Follow-ups: the core's date parser gives a dive from 2030 on `when` 0 when the file is
  read back, seen while testing (`2030-01-01` saved, 0 after a load). Not caused by undo,
  and it would hit a plan dated that far ahead on any relaunch. Worth a look upstream.

- 2026-11-07 - Configurable statistics (task 16).

  **How far `stats/` reuses.** `stats/statsvariables.cpp` and `stats/statsstate.cpp` compile
  byte-identical to upstream, with no patch: their Qt is strings, locale number formatting and
  translation markers, and `cpp/shim/include/ssrf-qstring.h` stands in for those. So the
  29 variables, binners, operations and valid combinations are the desktop's. The rest of
  `stats/` draws through Qt Quick, and `statsview.cpp` keeps the data and the drawing in one
  function per chart type. That data half is ported to `cpp/bindings/stats-chart.cpp`, in C++,
  function for function; the regression, confidence area and pie slice selection with it.
  TypeScript adds nothing up, except folding series past the eighth colour into "Other".

  **Decisions.**
  - Planned dives keep counting by default, because the numbers must match desktop, where
    `DiveFilter` shows them. A log holding any gets a "Without planned dives" chip on the
    overview and on charts, saying they are counted now. `excludePlanned` is a filter of
    `getStatistics` and `statsChart` alike. This closes the planner's follow-up.
  - One filter: the overview's, shared through `statistics-context.tsx` and shown on the chart
    screen. Session only, as it was.
  - The configuration is JSON in `settings.json`, replayed through `StatsState` on each call.
    It replays to itself, tested across variables and offered charts, or a relaunch would move
    a chart. Variables and enums go by name, binners by index.
  - Rows, not a canvas, for horizontal charts: a virtualized list, each row a button. A long
    list of names (sites, people, tags and so on) becomes rows when chosen.
  - Left out, with reasons: `docs/tasks/16-configurable-statistics.md`.

  **Found on the simulator, not by the tests.** With the chart undimmed behind the builder
  sheet, its back button popped the chart from under the sheet, so the sheet is dimmed. Chart
  rows' text took the button tint, and the sheet had no Done. A settings write re-rendered
  every `useUnitSystem()` consumer, the dive list among them, which is a real cost on a large log;
  it now selects.

  **Verified.** `tests/stats-chart.test.ts`: per-year counts, operations, quartiles, stacked
  splits and regression worked out from each dive's values with upstream's formulas written
  out; the mean depth per year against `statistics.cpp`; every var1/var2 pair valid; imperial
  binners with the preference restored; filters; undo history untouched; empty log; every
  variable over every loadable file of `subsurface/dives/`; 5000 dives; `subsurface.xml`.
  Also under AddressSanitizer. `tests/stats-chart-presets.test.ts`: each preset stays what it
  says and has data on `subsurface.xml`, in both units for its binners. Model tests: words, rows,
  readouts, summaries, folding, label collisions at any bin count, hit testing. vitest, lint and
  typecheck. Palette through the data-viz validator against this app's surfaces, all gates
  pass, the numbers in `chart-theme.ts`.

  On an iOS 27 simulator of its own, since deleted, with a copy of `subsurface.xml`: overview
  with the explore row, explore in light and dark, scatter, stacked histogram, rows, histogram with
  mean and median, box plot, pie; tapping a dot, a bar, a slice; a row through to its dives and
  on to a dive; the builder in a sheet with the chart following, the sectioned variable menu,
  steps through a picker on the large log not reached (see below); a filter on a chart, and its
  empty state; the last chart surviving relaunches; histogram in landscape, Show dives from there,
  rows in landscape, a dive's profile rotating when opened from a chart. The iOS native build
  links the two upstream files. On 5000 dives (`writeLargeLog`, 284 MB, its 24 dives repeated, so
  dots overlap): press to chart 310 to 347 ms in a debug build, measured in the app, and a tap on
  a dot answered; `statsChart` itself 10 to 13 ms at `-O0` on the macOS host.

  **Not verified.** Numbers from a running desktop Subsurface: there is no Qt on this machine, so
  nothing was compared side by side; the claim rests on the same source being compiled, and on
  the expectations above. Anything on a real device, frame rates included: smoothness rests on the
  measurements above and on looking, not on a profiler. Scrubbing by drag, a monthly chart of
  hundreds of bins on screen (the test driver gave up on the large log's accessibility tree before
  it got there; geometry is tested), grouped columns, dots per group's quartiles beyond one
  glimpse behind the sheet, the planned-dives chip and imperial on screen (no such dive in that
  log; both are covered at the bindings), undo while on a chart. VoiceOver itself: labels were read
  through the accessibility tree, not spoken. Dynamic Type. Android: `explore.tsx`, `builder.tsx` and
  the portable list typecheck but have not been built or run, and neither has the module on
  Android with the two new files; `dynamic_cast` in `statsvariables.cpp` needs RTTI there.

  Follow-ups: `StatusView`'s loading spinner sits at the left edge on iOS, seen here and not caused
  by this. A selected chip is hard to tell from the others in dark mode, as before. Labels round
  with `toFixed` where upstream uses printf, so an exact binary tie (15.25) can differ in its last
  shown digit. Upstream's `abs(t)` in `is_linear_regression` can bind to the integer `abs`, depending
  on the library, so desktop may draw a line here that this one does not, or the reverse, near the
  threshold; ours uses `std::abs`, and it may be worth raising upstream.

- 2026-11-07 - Adding a dive manually, and correcting date, temperatures, number and depth.

  **Bindings.** `addDive` is `Command::AddDive` with autogrouping off, on a dive built like
  `default_dive()`: a computer named "manually added dive", samples from `fake_dc()`.
  `previewNewDive` returns the same dive unadded, for the SAC on the form, and is listed as
  a read in `history.cpp`. `DivePatch` gained `when`, `airTempMkelvin`, `waterTempMkelvin`,
  `durationSec`, `maxDepthMm` and `meanDepthMm`. No core file was added, so
  `CORE_MANIFEST.md` is unchanged, and nothing under `subsurface/` was edited.

  **What the core does, and the app follows.**
  - Numbering: `get_dive_nr_at_idx()`. The next number at the end of the log, 1 in an empty
    one, 0 in the middle, with nothing renumbered. The form says so when a later dive exists.
  - Trips: with autogrouping off, which is the app's rule, a dive inside a trip's dates joins
    no trip. The form says so and the dive screen offers to add it. A dive whose date changes
    stays in its trip wherever it lands and keeps its number, as in `Command::EditDive`.
  - A new date also sets `dcs[0].when`, as legacy's `checkDate` does, and only that computer.
  - A new depth or duration clears the average first (`EditDepth`, `EditDuration`).
    `fixup_dive()` only raises a maximum it finds set, so the maxima are zeroed first, as in
    `AddDive`; without that a dive could never get shallower.
  - Clearing a temperature on a dive whose computer reported one brings that one back
    (`fixup_watertemp`, `fixup_airtemp`).

  **Decisions.** No default cylinder: the core's has no pressures, so gives no SAC, and says
  "unknown". The previous-dive card copies a real setup in one tap. Depth or duration on a
  dive that is not manual is refused by the bindings rather than logged and half applied, as
  legacy's `checkDuration` does. Limits: 1 m to 500 m (the cap is legacy's), up to 24 hours,
  dates before 2030, since `utc_mktime()` reads any later year as 0. The form also refuses a
  date over a day ahead, except on a planned dive, and an average under a tenth of the maximum,
  which `fake_dc()` would silently replace. Overlaps warn and do not block. What a dive already
  had is not held against it when other fields are edited.

  **UI.** `src/features/dives/dive-form.tsx` is the one form, used by the editor and by the new
  `dives/add` modal. The Dives header has a plus menu in place of the Download icon; the empty
  state offers both ways in. After saving, the dive opens with the existing toast. A manual dive
  says the profile is drawn and nothing was measured, shows "None, added manually" instead of a
  model and sample count, and words its CSV export to match. On a downloaded dive the editor
  takes the date, temperatures and number, and shows depth and duration read-only.

  Verified: `tests/add-dive.test.ts` through the host binary, also under AddressSanitizer:
  numbering, profile, statistics, SAC, the file, a load and save coming back identical, undo and
  redo byte for byte, the manual and downloaded rules, dates moving in the tables and within a
  trip. `src/models/dive-basics.test.ts` for parsing, units, validation and patches. vitest, lint
  and typecheck. On a throwaway iOS 27 simulator with a copy of `abitofeverything.ssrf` and then
  an empty logbook, since deleted, the booted simulators untouched: in light and dark, the menu,
  the sheet, validation, Cancel and swipe both asking before discarding, Save opening the dive
  with the toast, a live SAC, the overlap warning, editing depth on a manual dive and the date on
  a downloaded one through the native picker, undo of both back through the menu with the dive's
  screen leaving, the first dive of an empty log numbered 1, the file on disk at each step, a
  relaunch keeping it, and the fullscreen profile in landscape. The app holds portrait everywhere
  else, so the sheet was not looked at in landscape beyond that lock.

  **Not verified.** Opening a saved manual dive in desktop Subsurface: the file was checked
  against what the core writes and reads, not in the desktop app. Anything on a real device,
  including haptics. Android: the portable header menu, cancel button and date steppers typecheck
  but were neither built nor run. VoiceOver speaking any of it (the accessibility tree was read,
  not heard). Imperial units and the note about a trip's dates on screen: unit tests only. Dynamic
  Type. Redo of an add on screen, which is covered at the bindings only.

  One Save tap did nothing right after closing Expo's dev menu, and the next one saved. Its
  floating Tools button also sits over Save and takes taps meant for it. Other first taps saved,
  including one with the keyboard up, so this reads as the dev menu's, but it was not pinned down.

  Known and left: with pressures entered, the chart draws a tank pressure line interpolated by the
  core, and a deco ceiling from the drawn profile, under the note that nothing was measured. The
  undo commit's follow-up about 2030 stands, and is why dates stop there. The version was not
  bumped.

- 2026-11-07 — Android has its own UI, in Jetpack Compose through `@expo/ui`. iOS keeps its
  SwiftUI screens. Until now Android drew the portable React Native variants, which are
  iOS-shaped cards in iOS colours.

  **How it is split.** A screen with a native UI has `x.ios.tsx`, `x.android.tsx` and the
  portable `x.tsx`, which is now what web renders. All three read the same screen hook, so
  nothing but the drawing differs. `src/components/material/` is the kit the Android files are
  built from (rows, menus, dive row, action sheet, date and time rows). It imports
  `@expo/ui/jetpack-compose`, so only `.android.tsx` files may import it, the way
  `dive-row-swift.tsx` works on iOS. Routes with both native variants stay in the iOS bundle's
  route context, as iOS ones do in the Android bundle; both apps ran with them there.

  **Colour.** `use-theme.android.ts` maps the tokens every screen reads onto the Material You
  palette, so the React Native screens match Compose and the wallpaper. Warning stays fixed:
  Material has no such role, and a warning must not change with the wallpaper. Navigation bars
  and the bottom bar take the same palette (`use-navigation-theme.android.ts`). `material/host.tsx`
  passes the appearance to every Host, since the activity handles night mode itself and a Host
  left alone keeps its first palette.

  **Native conventions used.** A floating action button adds a dive. A long press opens a modal
  bottom sheet where iOS has swipe actions and a context menu. Label-only header actions go in an
  overflow menu. Undo is a snackbar on the inverse surface. Editors use outlined text fields with
  supporting text for errors, filter chips, and Material's date and time dialogs. Steppers are
  tonal icon button pairs, since Android has no stepper and a slider would not land on an exact
  gradient factor. A section's rows sit in a tonal card, with its title and footnote outside.

  **What can be tapped.** The first version drew every row alike and nobody could tell. Now a value
  is plain text, an action is in the primary colour with an icon, or the error colour if it
  destroys something, a row leading elsewhere ends in a chevron, a choice in a dropdown arrow, and
  a date or time row in its icon. `M3ActionRow` takes `opens` for the second kind.

  **Icons.** Compose draws vector drawables, not the font expo-symbols uses, so
  `scripts/fetch-material-icons.mjs` writes `assets/material-symbols/` and
  `material/icon-assets.ts` from `MATERIAL_SYMBOLS`. `icon-assets.test.ts` fails if a symbol has no
  file. The screens keep naming SF Symbols. Nine symbols the Android side named but the table
  lacked were added, including `trash`, so these no longer draw as nothing.

  **Still React Native, in the Material palette.** Dive detail, statistics charts and filters, the
  site list over the map, site detail, download, git sync and SSI, because they hold charts and
  maps or have no platform split yet. Their form pieces come from `form.android.tsx`, so their
  fields are Compose. Confirmation dialogs remain `Alert.alert`: native, but AppCompat rather than
  Material 3. `ChoicePicker` is unchanged.

  Verified: typecheck, lint, vitest (1292 passed, 1 skipped). On a throwaway Pixel 9 Pro AVD (API
  36, Europe/Vienna), with a copy of `abitofeverything.ssrf`, in light and dark: list, FAB menu,
  undo and overflow menus, selection, long press sheet, trip, tools, gas menu, planner with its
  chart, statistics builder and its sectioned menu, settings. Adding a dive: typing, a validation
  error, a focused field scrolled into view, date and time dialogs giving the right wall clock
  under a non-UTC zone, Save, snackbar. 186 dives flung through without gaps. A release build,
  made debuggable so the device tools would drive it, draws the same with its icons. A throwaway
  iOS 27 simulator on the 1.8.0 dev client still shows the SwiftUI list and Settings.

  **Not verified.** A physical device; golden tests on Android; TalkBack heard; a phone with a
  soft keyboard over a field, since the emulator kept its hardware keyboard; a tablet's sidebar;
  a real wallpaper palette beyond the emulator's; site editor, SSI and git screens on screen after
  the form change; the undo menu's redo; merge. Opening an exported file in desktop Subsurface was
  not part of this.

  Known and left: switching appearance while the app runs leaves the status bar icons as they were
  until the next launch. Dropdown menus open from the start of a full-width row. Stars and warning
  keep fixed colours. The Material Symbols are Apache-2.0, as were the ones expo-symbols already
  drew; whether that sits well beside GPL-2.0 was not looked into.


- 2026-11-08 - **Make First Computer**: on a dive with several computers, the selected
  one can be moved to the front, desktop's "Make first dive computer". The first computer
  is what the SSI upload, CSV export, the summary's mode and the default profile read, so
  they follow it with no change of their own.

  Native: `makeFirstDiveComputer({ id, dcIndex })` in `cpp/bindings/api.cpp` does what
  `MoveDiveComputerToFront` (`commands/command_divelist.cpp`) does around the core's
  `clone_make_first_dc()`: the copy enters the old dive's trip and site, is registered
  (caches invalidated), and the old dive is deleted. Unlike desktop the dive keeps its id,
  taken back once the old dive is gone, so open screens and cached queries need only
  re-read. Index 0 changes nothing and leaves no undo step; an index out of range fails.
  Undo goes through the state history like every mutation; its entry names the computer
  ("Shearwater Petrel is now first on Dive 224"). No core file changed, so
  `CORE_MANIFEST.md` stays as it was.

  UI: "Make First Computer" in the computer picker's menu on iOS (Profile card and
  landscape profile), in the landscape dropdown on Android, and as a row under Dive
  computer on every platform (Android's portrait picker is a menu row with no room for
  it). The reordered dive and the new first computer's profile are cached before the
  selection moves to index 0, so the screen keeps showing the same computer. The SSI and
  CSV footers name the first computer and point at the action.

  Verified: vitest (`tests/make-first-computer.test.ts`, dive 224 of
  `abitofeverything.ssrf`): new order, same id, trip and site; the order survives a save
  and load; undo and redo to the file byte for byte; index 0 no-op; out of range and
  unknown dive rejected. Full suite, typecheck and lint green.

  On the iOS simulator (a throwaway one, `abitofeverything.ssrf` as the logbook), dive 333:
  the menu offers the action only for a computer that is not first; Shearwater Petrel made
  first moved to the top with the selection on it and the same profile shown; the undo
  toast and Undo put Aeris A300CS back first; the row under Dive computer did the same for
  the OSTC 3, and the CSV footer named it. Android was not run.


- 2026-11-09 - **iOS widgets**: four home screen and Lock Screen widgets through
  `expo-widgets` (layouts in `@expo/ui` SwiftUI, `src/widgets/`):

  | Widget | Families | Shows |
  | --- | --- | --- |
  | Last Dive | small, medium, large, Lock Screen circular / rectangular / inline | site, number, date, max depth, duration, water temperature; medium and large add the profile (Swift Charts area), large adds buddy and rating |
  | Surface Interval | small, Lock Screen circular / rectangular / inline | live-updating time since the last dive ended (a SwiftUI relative date, no timeline needed) |
  | Logbook Totals | small, medium, large, Lock Screen circular / rectangular / inline | dives, hours underwater, deepest, longest, average depth, sites; configurable period (all dives, this year, last 12 months); circular and large show a gauge to the next multiple of 50 dives |
  | Dive Activity | small, medium, large | dives per month over the last 12 months as bars, this year against last year, busiest month |

  Data: `src/models/widgets.ts` turns the dive list (and the newest dive's profile,
  thinned to 48 points keeping the deepest sample) into formatted props. Planned and
  invalid dives are not counted. `src/features/widgets/use-widget-sync.ios.ts`,
  mounted in the root layout, pushes them on every dive list re-read, unit change and
  return to foreground, sending each widget only when its props changed (WidgetKit
  reload budget). The surface interval reads the stored wall clock in the phone's
  current zone, since the core keeps no zone; a result in the future is held at now.

  Taps open the dive via `/dives/at/<start time>` (new route), not by id: ids are
  process-local and a widget outlives the process.

  Variants: `plugins/with-ios-variants.js` now gives the Debug build its own widget
  extension id (`codes.mani.subsurface-react.dev.ExpoWidgetsTarget`) and app group
  (`group.codes.mani.subsurface-react.dev`) through an `APP_GROUP_IDENTIFIER` build
  setting, so debug widgets never show the production logbook. `expo-widgets` is
  listed after it in `app.config.ts` so its mods run first. Android excludes
  `expo-widgets` from autolinking; the hook is a no-op there.

  Verified: vitest (`src/models/widgets.test.ts`, 16 tests incl. the sample logbook
  through the host bindings), full suite, typecheck, lint. `expo prebuild` output
  checked for both configurations, and a Debug simulator build succeeds with the
  extension embedded and its group expanded. Not yet run: the widgets on a simulator
  or device (gallery, rendering of each family, tap-through). The app group must be
  registered for both bundle ids on first signed build (automatic signing does this).


- 2026-11-09 - **Six parity gaps with the legacy Qt mobile app**, one commit each.

  1. **Dive summary periods.** The legacy summary model (`qt-models/divesummarymodel.cpp`) is
     Qt and not vendored, so its periods became a statistics filter: `getStatistics` takes
     `recentMonths` and the bindings place the start as the legacy model did (wall clock now,
     less N calendar months, day clamped, dives strictly after). The reply adds first and last
     dive, nitrox dives, dives past 39 m and the period's start. On the overview the periods
     join the year chips in one "When" row (picking one clears the other), so the configurable
     charts follow the same filter. A "Last dive" tile and the dive count's line show the rest.
  2. **Dive site on the map.** Dive detail gets a Dive site section when the site has a
     position: a small map, a row opening the site in the same stack (new `dives/site/[uuid]`
     and `statistics/site/[uuid]` routes; Sites keeps its own), and Open in Maps (Apple Maps
     link on iOS, `geo:` on Android). Site detail has Open in Maps too.
  3. **Units per quantity.** Settings holds `units` (depth, pressure, volume, temperature,
     weight) with Metric / Imperial / Custom; old files migrate from `unitSystem`, which is
     still written for older builds. Every formatter and parser takes `Units` and throws for a
     bare unit system; a test also scans the sources for unit-system reads. Planner notes, the
     configurable statistics and CSV export take `units` per call. CSV needed a stylesheet
     patch (`patches/xslt-0001`, byte for byte the same with only `units`) and core patch
     0012 (`transform_xslt` not static). The test harness now reads the patched stylesheets.
     The MCP server stays metric by design: each key names its unit.
  4. **Dates and times.** No setting of the app's own: the device's region and 12/24-hour
     clock are already the diver's choice. Every date goes through `src/models/date-format.ts`
     (expo-localization added for the clock), with an explicit hour cycle. Month names in the
     statistics, the configurable charts' date axis and the core's own month binner and trip
     titles (`configure({ monthNames })`, gettext shim) follow the region.
  5. **Default cylinder.** Settings, New dives: a type from the core's tank table, or None
     (the core's default). Set as the core's `default_cylinder` through `configure`;
     `defaultCylinder` returns `create_new_cylinder()`, which seeds a new dive's cylinder, Add
     Cylinder in the editor and the planner's cylinders. Downloads use it where the core does.
  6. **Ceilings and grid.** The profile draws the computer's reported ceiling (red, desktop's
     DiveReportedCeiling) and the core's calculated ceiling (green, dashed) apart, named in
     the legend, the scrub readout and the VoiceOver summary; a 3 m grid quantizes to 3, 6,
     15 x 10^n in the displayed unit, as desktop does (30/60/90 ft in feet). Settings splits
     Decompression (GF) from a Profile section with five switches. Defaults are the core's:
     computer ceiling on, calculated ceiling and grid off - so the calculated ceiling, always
     drawn until now, is off until switched on. The planner's chart follows the same switches.

  Verified: vitest 79 files, 1391 passed, 1 skipped (new: `tests/units.test.ts`,
  `month-names.test.ts`, `default-cylinder.test.ts`, period tests in `statistics.test.ts`, and
  model tests for settings migration, units, date formats, ceilings, grid, maps links).
  Typecheck and lint clean. On a throwaway iPhone 18 Pro simulator (iOS 27, region de-AT,
  `abitofeverything.ssrf`): Custom units with feet and bar on lists, detail, editor and
  profile; both ceilings and the 3 m grid in feet on dive 333 (Shearwater Petrel) with the
  readout naming both; landscape fullscreen; dark mode; Dive site section, site in the Dives
  stack, Open in Maps opened Apple Maps; 3 months period ("Dives after 9. Aug. 2026"); Add
  Dive seeded with AL80. A throwaway iPad Pro 13" simulator: detail pane with the site
  section and the site pushed in the detail stack. A throwaway Pixel 9 Pro AVD (API 36, en-US,
  12-hour): Material Settings with Custom unit rows, psi in the default cylinder list,
  profile with metres and psi and the calculated ceiling, site section on MapLibre, Open in
  Maps reaching Google Maps with a named pin, statistics in dark mode. All three devices were
  deleted afterwards; the user's simulators were not touched.

  **Not verified.** CSV files from the app opened in desktop Subsurface; the default cylinder
  filling a downloaded dive (the simulated computer reports no gas, so the test only shows no
  cylinder is invented); a device whose 12/24-hour switch differs from its region on iOS;
  VoiceOver and TalkBack heard; the planner on screen with the new switches; Android tablet;
  Android landscape. Not added: a date or time format override, deliberately.

  Known and left: cylinder size in cubic feet is shown and entered as water volume (an AL80
  reads 0.4 cuft) in the editor, as before this change; only the new default cylinder list
  names imperial types by their gas capacity (AL80, 80 cuft).
