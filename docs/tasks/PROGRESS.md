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
- [ ] 13 — Android parity (later phase)

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
