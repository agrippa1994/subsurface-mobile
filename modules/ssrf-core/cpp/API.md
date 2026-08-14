# ssrf-core module API (task 05)

The native module owns the in-memory `divelog`. TypeScript is a view/controller
layer that holds no copy of it: every read goes back to C++.

## Transport

One native function, not one per method:

```
call(method: string, argsJson: string) -> string
```

- `ios/SsrfCoreBridge.{h,mm}` forwards it to `ssrf::call` in
  `cpp/bindings/api.cpp`.
- `ios/SsrfCoreModule.swift` exposes it as an Expo synchronous `Function`, which
  Expo dispatches over JSI - no bridge serialization.
- `src/index.ts` wraps each method in a typed function.

Adding a method therefore touches exactly two files: the dispatch table in
`api.cpp` and the wrapper in `src/index.ts`. The Objective-C++/Swift glue (and
later the JNI glue) never changes again.

Both directions are JSON, marshalled with `nlohmann/json` (see
`cpp/third_party/README.md`). The reply is always an envelope:

```jsonc
{ "ok": true,  "result": <value>, "errors": ["..."] }   // errors only if the core reported any
{ "ok": false, "error": "<message>", "errors": ["..."] }
```

`errors` carries whatever the core routed through `report_error()` during the
call; `api.cpp` installs the `set_error_cb` sink that collects them.
`src/index.ts` turns `ok: false` into a thrown `SsrfCoreError` that carries
`coreErrors`.

## Units

Raw core units, always integers, never formatted:

| Quantity | Unit | Suffix |
| --- | --- | --- |
| depth | millimetre | `Mm` |
| pressure | millibar | `Mbar` |
| temperature | millikelvin | `Mkelvin` |
| volume | millilitre | `Ml` |
| weight | gram | `Grams` |
| duration | second | `Sec` |
| gas fraction | permille | `Permille` |
| coordinates | microdegree | `Udeg` |
| timestamps | Unix seconds, UTC | `when` |

Conversion and locale formatting live in TypeScript so the same numbers can be
rendered metric or imperial.

## Identifiers

- **`dive.id`** is the core's *runtime* handle (`dive::id`, a process-local
  counter). It is stable while the log stays loaded and is **not** persisted -
  after `loadFromXML` every id is different. Never store one across a load.
- **`diveSite.uuid`** *is* persisted in the SSRF file and is stable.

## Methods

| Method | Arguments | Result |
| --- | --- | --- |
| `loadFromXML` | `{ path }` or `{ base64 }` | `{ dives, sites, trips }` |
| `saveToXML` | `{ path }` | `{ path, dives }` |
| `clear` | `{}` | `{}` |
| `importSuunto` | `{ path }` or `{ base64 }` | `{ added, merged, failed, dives }` |
| `listDives` | `{}` | `DiveSummary[]` |
| `getDive` | `{ id }` | `Dive` |
| `getProfile` | `{ id, dcIndex? }` | `PlotInfo` |
| `getStatistics` | `{ filter? }` | `StatsSummary` |
| `listDiveSites` | `{}` | `DiveSite[]` |
| `upsertDiveSite` | `DiveSiteInput` | `{ uuid }` |
| `deleteDiveSite` | `{ uuid }` | `{ sites }` |
| `updateDive` | `{ id, patch }` | `Dive` |
| `getLastError` | `{}` | `string` |

`ArrayBuffer` arguments cross as base64 (`base64` key); a `path` is used
directly and avoids the copy.

### Behaviour worth knowing

- **`loadFromXML`** clears the divelog first, then runs
  `divelog.process_loaded_dives()` - the same post-processing the desktop app
  does after a load (dive numbering, surface intervals, CNS, sorting).
- **`saveToXML`** writes `path.tmp` via `save_dives()` and `rename(2)`s it over
  the target, so an interrupted write can never truncate the logbook. The SSRF
  file is the source of truth; there is no database.
- **`importSuunto`** probes the sqlite schema exactly as `core/file.cpp` does
  (`SampleBlob` -> DM5, `ProfileBlob` -> DM4), parses into a scratch `divelog`
  and merges with `add_imported_dives(..., merge_all_trips)`. `merged` is
  `imported - added`. A buffer is staged to a temp file first, because the
  importers read profile blobs through sqlite and sqlite needs a real file.
  The zipped `.SDE` container is task 11.
- **`getProfile`** runs `create_plot_info_new(dive, dc, nullptr)`, i.e. the same
  computation the desktop profile widget plots, including deco/ceiling and gas
  partial pressures.
- **`getStatistics`** marks the dives matching `filter` as `selected` (that is
  the input the core's statistics code takes) and then calls
  `calculate_stats_summary(true)` and `calculate_stats_selected()`. The
  selection is left in place afterwards; nothing else in the module reads it.
- **`updateDive`** applies only the keys present in `patch`, then calls
  `dive::invalidate_cache()` because the full-text cache indexes notes, buddy
  and tags. `siteUuid: 0` detaches the dive from its site.
- **`deleteDiveSite`** detaches every dive from the site before destroying it,
  so no `dive::dive_site` pointer is left dangling.

## JSON key mapping

Key names are lowerCamelCase versions of the core field names, with the unit as
a suffix. TypeScript declarations in `src/SsrfCore.types.ts` are the normative
list; the mapping to the C++ structs is:

| JSON | C++ | Header |
| --- | --- | --- |
| `DiveSummary`, `Dive` | `struct dive` | `core/dive.h` |
| `Dive.cylinders[]` | `cylinder_t` | `core/equipment.h` |
| `Dive.weightsystems[]` | `weightsystem_t` | `core/equipment.h` |
| `Dive.dcs[]` | `struct divecomputer` | `core/divecomputer.h` |
| `DiveComputer.events[]` | `struct event` | `core/event.h` |
| `DiveComputer.extraData[]` | `struct extra_data` | `core/extradata.h` |
| `GasMix` | `struct gasmix` | `core/gas.h` |
| `DiveSite` | `struct dive_site` | `core/divesite.h` |
| `DiveSite.taxonomy[]` | `struct taxonomy` | `core/taxonomy.h` |
| `PlotInfo` | `struct plot_info` | `core/profile.h` |
| `PlotEntry` | `struct plot_data` | `core/profile.h` |
| `Stats` | `struct stats_t` | `core/statistics.h` |
| `StatsSummary` | `struct stats_summary` | `core/statistics.h` |

### Profile pressures

`plot_info::pressures` is `nr_cylinders` blocks per sample, indexed
`cylinder + sampleIndex * nr_cylinders` (`profile.h:126`). That exact layout is
preserved as two flat arrays of `nr * nrCylinders` millibar values:

```jsonc
"pressures": { "sensor": [ ... ], "interpolated": [ ... ] }
```

`plotPressureAt(pi, sampleIndex, cylinder)` in `src/index.ts` does the indexing
and the sensor -> interpolated fallback.

### Deliberate omissions

Emitted per sample only when they are cheap; these are left out because they
would multiply the payload by ~30 and nothing in v1 draws them:

- `plot_data::ceilings[16]` and `percentages[16]` (per-tissue ceilings, the
  desktop's tissue heat map).
- `plot_data::o2sensor[6]` (individual rebreather sensor readings). The
  consensus value is exposed as `o2pressureMbar` and the setpoint as
  `o2setpointMbar`.
- `sample` structs. The plotted `entry` array supersedes them; raw samples are
  reachable through `DiveComputer.sampleCount` only as a count.

Add them behind an option if a later task needs them.

## Exercising the API on the host

`scripts/build-host.sh` builds the same C++ for macOS in seconds and links
`tests/main.cpp`:

```sh
./scripts/build-host.sh --build
./build/host/ssrf-smoke api ../../subsurface/dives/test29.xml     # acceptance walk-through
./build/host/ssrf-smoke call loadFromXML '{"path":"..."}' listDives '{}'
```

`call` takes several method/args pairs per invocation because the divelog lives
in the process: loading a file and then querying it needs one process.
