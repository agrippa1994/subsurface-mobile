# Core manifest

What of the Subsurface core this module compiles, what had to be patched, and
what the shim replaces. Keep this file accurate: it is the only record of how
far the mobile build diverges from upstream.

## Pins

| Component | Pin |
| --- | --- |
| `subsurface/` submodule | `e412ccb85` ("Import: Fix Bluetooth 'Auto' Mode.") |
| Core version string | `6.0.5658` (from `subsurface/scripts/get-version.sh`) |
| `subsurface/libdivecomputer` submodule | `ffb7cab4c` — 0.10.0-devel-Subsurface-NG |

## How the build is assembled

`subsurface/` is read-only. `scripts/vendor-core.mjs` copies the subset into
`cpp/generated/` (git-ignored), applies `patches/*.patch`, then overlays
`cpp/shim/override/`. The Expo config plugin `plugin/withSsrfCore.js` runs it
before `pod install`; `scripts/build-host.sh` runs it for the host build.

Include order matters: the core includes its headers by bare name, so an
overridden header wins by replacing the copy in `cpp/generated/core/`.

## Compiled core sources (37)

**Model** — `dive.cpp`, `divecomputer.cpp`, `divelist.cpp`, `divelog.cpp`,
`divesite.cpp`, `device.cpp`, `equipment.cpp`, `event.cpp`, `eventtype.cpp`,
`gas.cpp`, `gas-model.cpp`, `picture.cpp`, `sample.cpp`, `tag.cpp`,
`taxonomy.cpp`, `trip.cpp`, `units.cpp`, `pref.cpp`

**Format** — `parse.cpp`, `parse-xml.cpp`, `save-xml.cpp`, `xmlparams.cpp`,
`filterpresettable.cpp`, `membuffer.cpp`, `time.cpp`, `subsurface-string.cpp`,
`strtod.cpp`, `errorhelper.cpp`, `sha1.cpp`, `version.cpp`

**Importers** — `import-suunto.cpp`

**Math** — `deco.cpp`, `planner.cpp`, `plannernotes.cpp`, `profile.cpp`,
`gaspressures.cpp`, `statistics.cpp`

All headers in `subsurface/core/*.h` are copied (they include each other by
bare name; cherry-picking them would only add churn).

Deliberately excluded: `cloudstorage`, `git-access`, `libdivecomputer.cpp` (the
downloader), `configuredivecomputer*`, `qt-ble`, `btdiscovery`, `file.cpp`
(multi-format/zip dispatch — task 11), image/video, and everything under
`desktop-widgets/`, `qt-models/`, `mobile-widgets/`.

## libdivecomputer

Headers only. The subset uses libdivecomputer solely for its enums
(`SAMPLE_EVENT_*`, `DC_*` water types, parser field ids) — no `dc_*` function is
called anywhere in it, verified by grep over the compiled sources. The C library
is therefore not built. `version.h` is generated from `version.h.in` with the
three numbers read out of `libdivecomputer/configure.ac`.

If a future task adds the download path, this becomes "build libdivecomputer as
a static C lib" — the enums would then already match by construction.

## Patches (build-time, `patches/`)

| Patch | Files | What and why |
| --- | --- | --- |
| `0001-strip-qt-metatype-declarations` | `dive.h`, `divesite.h`, `trip.h`, `triptable.h` | Each ends with `#include <QObject>` + `Q_DECLARE_METATYPE` for the desktop's QVariant plumbing. Only Qt reference in those headers. |
| `0002-qt-free-eventtype-and-helpers` | `eventtype.{h,cpp}` | The one file in the subset whose *interface* is `QString`. Ported to `std::string`; `QStringLiteral("%1 (%2)").arg()` becomes concatenation, `gettextFromC::tr()` becomes `translate()`. |
| `0003-profile-use-std-mutex` | `profile.cpp` | `QMutex planLock` guards the shared deco planner state, used only via `lock()`/`unlock()`. `std::mutex` has the same interface for both. |
| `0004-device-decode-fingerprint-without-qt` | `device.cpp` | Only Qt use is `QByteArray::fromHex()` when reading a dive computer fingerprint back from the log. Replaced with an inline nibble decoder that skips non-hex characters, as Qt does. |
| `0005-profile-bound-o2-sensor-loop` | `profile.cpp` | Not a Qt patch: an upstream stack-buffer-overflow. `fill_o2_values()` keeps `pressure_t last_sensor[3]` but loops to `dc->no_o2sensors`, which comes straight out of the logbook and may be up to `MAX_O2_SENSORS` (6). Reachable from `getProfile` with `dives/Liberty_CCR_header_v1_00000011.dlf.xml`. Reported upstream; drop when the pin carries the fix. |

A patch that stops applying fails the build. That is intended: it is the signal
that the submodule pin moved under a hand-written assumption.

## Replaced headers (`cpp/shim/override/`)

| Header | Replaced because | Kept surface |
| --- | --- | --- |
| `gettext.h` | Adds `QT_TRANSLATE_NOOP`, which `dive.cpp` / `equipment.cpp` use while including only this header (they get it via Qt upstream). | `translate()`, `trGettext()` |
| `gettextfromc.h` | Upstream is a `Q_DECLARE_TR_FUNCTIONS` class returning `QString`. | `gettextFromC::tr()` returning `translated_string` (a `std::string` that also answers `toStdString()`) |
| `format.h` | Declares QString formatters alongside the std ones. | `format_string_std`, `vformat_string_std`, `casprintf_loc` |
| `string-format.h` | ~70 QString/QStringList formatters for the desktop UI. | `printGPSCoordsC`, `get_dive_date_c_string` |
| `qthelper.h` | The desktop grab bag: QLocale formatting, Qt resources, proxies, cloud reachability, thumbnails. | `string_to_{weight,depth,pressure,volume,fraction}`, `get_dive_datetime_from_isostring`, `get_current_date`, `get_stylesheet`, `set_xslt_directory`, `subsurface_user_agent`, `get_file_name`, `local_file_path`, `emit_reset_signal` |
| `fulltext.h` | QString word cache for the desktop dive list. | `full_text_cache`, `FullTextQuery`, `StringFilterMode`, the register/unregister entry points |
| `divefilter.h` | Declares the `DiveFilter` singleton driving the desktop list. | `FilterData` (the payload of a filter preset, which is part of the file format) |
| `filterconstraint.h` | `QStringList *` inside the constraint union plus a large translated-label API. | Enums, `filter_constraint` with `std::vector<std::string> *`, token conversions, `filter_constraint_data_to_string` |
| `selection.h` | `QVector` selection API and Qt signalling. | `current_dive`, `amount_selected`, `select_single_dive`, `select_newest_visible_dive`, `clear_selection`, `getDiveSelection` |
| `git-access.h` | Includes `git2.h`; cloud/git logbooks are out of scope. | Cloud host macros, `git_info`, `is_git_repository` (always false), `git_save_dives`, `clear_git_id`, `set_git_id` |
| `settings/qPrefDiveComputer.h` | QSettings-backed preference object. | `device()` — empty, there is no download flow |

`cpp/shim/include/QtGlobal` and `cpp/shim/include/QtCore` are stand-ins on the
include path: `gas.cpp`, `tag.cpp`, `taxonomy.cpp` and `time.cpp` include them
for `QT_TRANSLATE_NOOP` alone, and providing the macro from a same-named header
leaves those four files byte-identical to upstream.

`cpp/shim/include/ssrf-stdlib-compat.h` is force-included (`-include`) into every
translation unit. It supplies `<numeric>`, which several core files rely on
arriving transitively through a Qt header.

## Shimmed implementations (`cpp/shim/`)

| File | Provides | Divergence from upstream worth knowing |
| --- | --- | --- |
| `gettext.cpp` | `trGettext` | Identity. Localization is deferred to the TypeScript layer. |
| `format.cpp` | the `std::string` formatters | Formats in the **C locale**. Upstream routes through `QString::arg()` and formats per `QLocale`. Every consumer in the subset writes XML or a log line, where a localized decimal separator would be a bug. |
| `string-format.cpp` | `printGPSCoordsC`, `get_dive_date_c_string` | `get_dive_date_c_string` renders fixed `YYYY-MM-DD HH:MM` in UTC instead of `prefs.date_format_short` via QLocale. |
| `qthelper.cpp` | the qthelper corner above | `string_to_*` match upstream except that the **localized** unit suffixes ("kg"/"lbs"/"m"/"ft"/…) are only recognized in English. `get_current_date` maps the common `prefs.date_format_short` patterns onto `strftime`. `get_stylesheet` reads from the directory set by `set_xslt_directory()` instead of Qt resources. |
| `fulltext.cpp` | no-op index, `FullTextQuery` | Indexing is a no-op; the query keeps its text so presets round-trip. Tokenizer splits on whitespace rather than Qt's Unicode-aware folding. |
| `filterconstraint.cpp` | the tokens, ctors and `data_to_string` | Port of ~200 of upstream's 1112 lines. The token tables are byte-identical (they land in the file). Numerical defaults for a *newly created* constraint are a neutral 0..0 instead of upstream's per-unit ranges — nothing in the mobile build creates constraints. |
| `filterpreset.cpp` | `filter_preset` methods | Straight port; only the QString round trip disappears. |
| `selection.cpp` | current-dive tracking | Single-dive selection only, no signals. |
| `git-access.cpp` | git storage stubs | `is_git_repository()` always false, so save-xml always takes the plain XML path. |
| `platform.cpp` | POSIX wrappers from `core/ios.cpp` | Wrappers are verbatim. The data directory comes from `set_data_directory()` (the app passes its container path) instead of `QStandardPaths`. The libzip wrappers are not defined yet — task 04/11. |
| `divecomputer-hash.cpp` | `calculate_string_hash` | Upstream defines it in `libdivecomputer.cpp` (the downloader, out of scope). Same SHA1-based body, so dive ids match. |
| `qPrefDiveComputer.cpp` | `qPrefDiveComputer::device()` | Always empty. |

## Native dependencies

| Library | iOS | Host (macOS) |
| --- | --- | --- |
| libxml2 | SDK (`libxml2.tbd`, headers under `$(SDKROOT)/usr/include/libxml2`) | SDK |
| sqlite3 | SDK (`libsqlite3.tbd`) — needed by `import-suunto.cpp` | SDK |
| zlib | SDK | SDK |
| libxslt | **vendored**: `ios/vendor/libxslt.xcframework` + `ios/vendor/include`, built from source 1.1.43 by `ios/vendor/build/build-libxslt.sh` | SDK (headers and library) |
| libzip | not yet needed — nothing in the current subset includes `zip.h`; arrives with the zipped-format import path in task 11 | not yet needed |

## Vendored third-party sources

| Path | Upstream | Version | License | Why |
| --- | --- | --- | --- | --- |
| `cpp/third_party/nlohmann/json.hpp` | nlohmann/json | v3.11.3 single-include | MIT | Marshalling for the JSI boundary (`cpp/bindings/`) |

Header-only and reached through `HEADER_SEARCH_PATHS`, deliberately *not* listed
in the podspec's `source_files` — same reasoning as libxslt's headers, see
below. See `cpp/third_party/README.md` for how to reproduce the file.

### libxslt notes

The iOS SDK ships `libxslt.tbd` but no libxslt headers, so the SDK copy is
unusable; building from source also pins the version (1.1.43) instead of
inheriting Apple's 1.1.35. The build script cross-compiles device arm64 and
simulator arm64+x86_64 (a generic simulator build needs both), merges
`libxslt.a` + `libexslt.a` per slice, and emits an xcframework **without**
attached headers — headers attached to an xcframework become public headers of
the pod, which flattens them into `Pods/Headers/Public` and drags `exslt.h`
into the module umbrella. They live in `ios/vendor/include` and are reached
through `HEADER_SEARCH_PATHS` instead.

The slice is linked by explicit path in `OTHER_LDFLAGS` rather than through
`vendored_frameworks`: CocoaPods turns a static-library xcframework into a bare
`-lxslt-combined` with no search path. The flags are set on the *user* target
too, since the app performs the final link, and both keep `$(inherited)`.

## Bindings (`cpp/bindings/`)

The module API, all new code — no upstream file is involved.

| File | Role |
| --- | --- |
| `api.h` / `api.cpp` | The single JSI entry point `ssrf::call(method, argsJson)`, its dispatch table, and the load/save/import/mutate implementations |
| `marshal.h` / `marshal.cpp` | Core structs → JSON, in raw core units |

Documented in `cpp/API.md`. Adding a method touches `api.cpp` and
`src/index.ts` only; the Objective-C++/Swift glue is method-agnostic.

## Smoke units

`cpp/ssrfcore.cpp` exposes two, reachable from JS and from
`tests/main.cpp` on the host:

- `smoke_serialize_minimal_log()` — builds a one-dive divelog and serializes it
  through `save-xml`.
- `smoke_count_dives_in_file(path)` — parses a logbook via `parse_xml_buffer`
  and returns the dive count.

Status: all 89 logbooks in `subsurface/dives/` parse on the host, and
`abitofeverything.ssrf` reports 18 dives. On the iOS simulator the home screen
runs serialize → write → parse and reports "459 bytes out, 1 dive(s) back",
which exercises save-xml, parse-xml and libxml2 on device. Parsing
`abitofeverything.ssrf` *on device* additionally needs the file bundled as an
app asset - not done, so that number is host-verified only.
