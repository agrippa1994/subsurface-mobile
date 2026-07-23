# 03 — Vendor Core Subset & De-Qt Shim

**Goal:** Compile the Qt-free Subsurface core subset inside the `ssrf-core` module by
providing non-Qt implementations of the few helpers it needs and patching the handful of
headers that leak Qt. **This is the highest-risk task — expect iteration.**

**Prerequisites:** Task 02 (module builds & runs C++).

## Strategy

Compile core files **straight from the `subsurface/` submodule** (do not copy/edit them).
Add our own `cpp/shim/` implementations and, where a core header pulls in Qt, apply a
**build-time patch** (a `.patch` under `modules/ssrf-core/patches/` applied by a config
plugin / prebuild hook) rather than editing the submodule. Track everything in
`cpp/CORE_MANIFEST.md`.

## Steps

1. **Declare the core subset** to compile (paths under `subsurface/core/`). Start minimal
   and grow until link succeeds:
   - **Model:** `dive.cpp`, `divelog.cpp`, `divelist.cpp`, `divesite.cpp`,
     `divesitehelpers.cpp`, `event.cpp`, `eventtype.cpp`, `equipment.cpp`, `gas.cpp`,
     `gas-model.cpp`, `sample.cpp`, `tag.cpp`, `trip.cpp`, `picture.cpp`, `taxonomy.cpp`,
     `units.*`, `pref.*`.
   - **Format:** `parse-xml.cpp`, `save-xml.cpp`, `parse.cpp`, `xmlparams.cpp`,
     `membuffer.cpp`, `subsurface-time.cpp`, `sha1.c`.
   - **Importers:** `import-suunto.cpp` (add `import-csv.cpp`, `import-shearwater.cpp`
     later if desired).
   - **Math:** `profile.cpp`, `deco.cpp`, `gaspressures.cpp`, `statistics.cpp`
     (`planner.cpp` optional for v1 — include only if it links cheaply).

2. **Patch Qt-leaking headers** (build-time patches, not submodule edits). Known case:
   - `core/divesite.h:37-39` tail-includes `<QObject>` and calls
     `Q_DECLARE_METATYPE(dive_site *)`. Guard or remove it (e.g. wrap in
     `#ifndef SSRF_NO_QT`). Grep the subset's headers for other `#include <Q`,
     `Q_DECLARE_METATYPE`, `QString`, `QObject` and neutralize each.

3. **Write the de-Qt shim** (`cpp/shim/`). Provide non-Qt versions of only the symbols the
   subset references from these headers — driven by the linker's undefined-symbol errors:
   - `qthelper.h` / `core/qthelper.cpp` — date/time formatting, unit conversions,
     misc helpers. Reimplement referenced functions with `std`/`<ctime>` only.
   - `format.h` / `string-format.h` — `std::string`-based formatting helpers.
   - `gettext.h` — make `translate()` / `gettext` an **identity pass-through**
     (localization deferred).
   - `pref` / settings globals — a minimal C++ settings struct initialized with sane
     defaults (metric/imperial, GF factors, etc.) matching upstream defaults.
   - `errorhelper` (`report_error`/`report_info`) — route to a log buffer we can surface
     to JS later.

4. **libdivecomputer symbols:** `parse-xml.cpp` includes `libdivecomputer/parser.h` for
   parser enums. Prefer compiling **libdivecomputer as a static C lib** (Qt-free, no BLE,
   no serial) so enum values match exactly. Only if that is disproportionate, stub the
   specific enums referenced. Record the choice in `CORE_MANIFEST.md`.

5. **CORE_MANIFEST.md:** list every compiled core file, every patch, every shimmed symbol,
   and the pinned upstream commit.

6. **Smoke unit (C++):** a function that constructs an empty `divelog`, adds one dive, and
   serializes it to an XML string via `save-xml` without crashing. Call it from JS through
   a temporary JSI binding.

## Acceptance criteria

- The module **links and loads** on iOS with the full subset compiled.
- The C++ smoke unit serializes a minimal `divelog` to non-empty XML on device.
- `CORE_MANIFEST.md` accurately lists compiled files, patches, shimmed symbols, and commit.

## Notes

- Work **incrementally**: add files until the linker complains, then shim/patch, repeat.
- Keep shim functions faithful to the Qt versions (compare against `core/qthelper.cpp`,
  `core/string-format.cpp`, `core/format.cpp`); subtle unit/formatting differences will
  surface later as round-trip diffs in task 06.
- Do **not** pull in `cloudstorage`, `git-access`, `libdivecomputer.cpp` (the downloader),
  `configuredivecomputer*`, `qt-ble`, `btdiscovery`, image/video — out of scope.
</content>
