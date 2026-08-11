# Progress

Update this checklist as tasks complete. A task is "done" only when its **Acceptance
criteria** pass. If blocked, leave it unchecked and add a note.

- [x] 00 — Overview & conventions read
- [~] 01 — Repo + Expo dev-client skeleton (code done; on-device build pending)
- [x] 02 — Native module scaffold (trivial JSI fn)
- [x] 03 — Vendor core subset + de-Qt shim compiles
- [x] 04 — iOS native deps link (libxml2/libxslt/sqlite3; libzip deferred to 11)
- [ ] 05 — JSI bridge + API implemented
- [ ] 06 — TS models + vitest golden tests green
- [ ] 07 — Navigation + dive list (read-only)
- [ ] 08 — Dive detail + profile diagram (Skia)
- [ ] 09 — Statistics screen
- [ ] 10 — Editing: dives, dive sites, buddies
- [ ] 11 — Suunto import + SSRF import/export
- [ ] 12 — Polish + TestFlight beta
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
  includes `zip.h`; it arrives with the zipped-format import path in task 11.
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
