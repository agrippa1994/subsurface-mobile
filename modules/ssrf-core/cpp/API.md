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
- An id the log does not have comes back as the envelope's `error`. The
  bindings must resolve ids themselves (`require_dive` in `api.cpp`) and must
  **not** call `divelog.dives.get_by_uniq_id()`: in a DEBUG build that function
  reports the id and then calls `exit(1)` (`core/divelist.cpp:757-765`), which
  terminates the app. Passing a stale id is normal - a screen open across a
  reload holds one - so it has to be an error, never a process death.

## Methods

| Method | Arguments | Result |
| --- | --- | --- |
| `loadFromXML` | `{ path }` or `{ base64 }` | `{ dives, sites, trips }` |
| `saveToXML` | `{ path }` | `{ path, dives }` |
| `clear` | `{}` | `{}` |
| `importSuunto` | `{ path }` or `{ base64 }` | `{ added, merged, failed, dives, sites }` |
| `importFile` | `{ path }` or `{ base64 }` | `{ added, merged, failed, dives, sites }` |
| `configure` | `{ xsltDir }` | `{ xsltDir }` |
| `listDives` | `{}` | `DiveSummary[]` |
| `getDive` | `{ id }` | `Dive` |
| `getProfile` | `{ id, dcIndex? }` | `PlotInfo` |
| `getStatistics` | `{ filter? }` | `StatsSummary` |
| `listDiveSites` | `{}` | `DiveSite[]` |
| `upsertDiveSite` | `DiveSiteInput` | `{ uuid }` |
| `deleteDiveSite` | `{ uuid }` | `{ sites }` |
| `updateDive` | `{ id, patch }` | `Dive` |
| `deleteDive` | `{ id }` | `{ dives, trips }` |
| `previewDive` | `{ id, patch }` | `Dive` |
| `ungroupDives` | `{}` | `{ dives, trips }` |
| `getLastError` | `{}` | `string` |

`ArrayBuffer` arguments cross as base64 (`base64` key); a `path` is used
directly and avoids the copy.

### Behaviour worth knowing

- **`loadFromXML`** clears the divelog first, then runs
  `divelog.process_loaded_dives()` - the same post-processing the desktop app
  does after a load (dive numbering, surface intervals, CNS, sorting).
- **Autogrouping is forced off** after every parse, on both the load and the
  import path (`disable_autogroup()`). A trip exists because the file declares
  one, never because two dives are within three days of each other. Without
  this the flag latches: `<autogroup state='1'/>` in any file ever loaded sets
  it, `parse-xml.cpp` never clears it and neither does `divelog::clear()`. The
  flag is consequently not written back out either.
- **`saveToXML`** writes `path.tmp` via `save_dives()` and `rename(2)`s it over
  the target, so an interrupted write can never truncate the logbook. The SSRF
  file is the source of truth; there is no database.
- **`importSuunto`** probes the sqlite schema exactly as `core/file.cpp` does
  (`SampleBlob` -> DM5, `ProfileBlob` -> DM4), parses into a scratch `divelog`
  and merges with `add_imported_dives(..., merge_all_trips)`. `merged` is
  `imported - added`. A buffer is staged to a temp file first, because the
  importers read profile blobs through sqlite and sqlite needs a real file.
  It is a narrower `importFile`, kept for callers that want the format pinned.
- **`importFile`** takes any supported file and detects the format from the
  *contents*, not the name:
  - `{`-leading text: the JSON the Suunto app exports, through
    `core/import-suunto-json.cpp`. Its paired `.fit` file is not read (see
    CORE_MANIFEST.md, patch 0007), so on an Ocean nitrox dive the gas mix and
    the gradient factors are missing - and CNS/OTU with them.
  - `SQLite format 3`: a Suunto DM4/DM5 database, as `importSuunto`.
  - a zip archive (`.sde`, `.dld`, `.zip`): every entry is parsed into the same
    import log by `cpp/bindings/zip-reader.cpp`. An entry that fails to parse is
    counted in `failed` rather than aborting the import.
  - anything else: XML, through `parse_xml_buffer()` - so an import covers
    everything the core's XSLT table does (Suunto DM4/SDM, UDDF, MacDive,
    DivingLog, ...) as well as plain SSRF. A Suunto DM4 XML document then has
    its sample blobs decoded by `cpp/bindings/suunto-xml.cpp`, which is a gap in
    the core rather than a mobile-only need - see that file's header.

  Everything merges with `add_imported_dives(..., merge_all_trips)`, so
  importing the same file twice merges instead of duplicating, and `merged` is
  `imported - added`. SAC, OTU and CNS are computed for the imported dives
  before they are merged (`update_cylinder_related_info`), because those are
  derived values that a freshly imported dive has nobody to compute for it -
  desktop Subsurface does it in its dive-list model.

  Note that dive sites arrive only with the dives that reference them: a site
  nobody dived is not carried over. That is the core's import path, and it is
  the difference between importing a logbook and opening one.
- **`configure`** hands the core the directory holding the XSLT stylesheets,
  which is how every non-SSRF XML format is read. It must be called before the
  first such import; the iOS bridge does it once from the pod's resource bundle
  (`SsrfCoreBridge.mm`), and the test harness does it with `subsurface/xslt`.
- **`getProfile`** runs `create_plot_info_new(dive, dc, nullptr)`, i.e. the same
  computation the desktop profile widget plots, including deco/ceiling and gas
  partial pressures. `dcIndex` is range-checked here because
  `dive::get_dc()` clamps and wraps it modulo the number of divecomputers - an
  out-of-range index would otherwise plot a different divecomputer instead of
  reporting the mistake. Note that `PlotInfo.maxDepthMm` is the *dive's* maximum
  depth, which can exceed the deepest plotted sample when the divecomputer
  recorded its maximum at a finer resolution than the sample interval.
- **`getStatistics`** marks the dives matching `filter` as `selected` (that is
  the input the core's statistics code takes) and then calls
  `calculate_stats_summary(true)` and `calculate_stats_selected()`. The
  selection is left in place afterwards; nothing else in the module reads it.
  Three fields on the reply are computed by the bindings rather than by the
  core, over that same selection (see `extra_statistics()` in `api.cpp`), because
  the core has no equivalent and aggregating them in TypeScript would put half
  the statistics on the other side of the boundary:
  - `timeline`: `{ year, month, dives, totalTimeSec, maxDepthMm }` per calendar
    month that has dives, chronological. The core's `monthly` groups by
    (year, month) too, but its `period` holds only the month, so a chart across
    years cannot label it.
  - `byDuration`: 10-minute buckets, `{ fromMin, toMin, dives, totalTimeSec }`,
    with `toMin: null` on the last, open-ended bucket at 180 min. 10 minutes is
    desktop's default duration binner (`stats/statsvariables.cpp`).
  - `siteCount`: distinct dive sites among the matched dives, counted by uuid.
- **`updateDive`** applies only the keys present in `patch`, then calls
  `dive::invalidate_cache()` because the full-text cache indexes notes, buddy
  and tags. `siteUuid: 0` detaches the dive from its site.

  `patch.cylinders` is the dive's *whole* resulting cylinder list rather than a
  delta. An entry carrying `sourceIndex` keeps the cylinder the dive has at that
  index and overwrites only the fields the entry mentions; an entry without one
  is a new cylinder. A cylinder left out of the array is removed - which the
  bindings refuse for one `dive::is_cylinder_used()` reports as used, since the
  samples and gas-switch events would be left pointing at a gas that is no
  longer there. Removals go through `remove_cylinder()` *and*
  `cylinder_renumber()`, the pair the core's own edit commands always run
  together: the first erases, the second moves the tank-sensor mappings and the
  gas-switch indices with it. Entries must stay in source order, with the new
  ones last, so a patch cannot express a reordering.

  Applying `cylinders` also runs `dive_table::update_cylinder_related_info()`,
  which recomputes `sac`, `otu` and `cns` - they are derived from the cylinders
  and their start/end pressures, so an equipment edit that left them alone would
  report the figures of the dive as it was. Desktop Subsurface does the same
  recomputation in its dive-list model.
- **`previewDive`** is `updateDive` against a throwaway copy of the dive: it
  returns what the dive *would* look like and mutates nothing. It exists for the
  editor's live SAC readout, which depends on gas compressibility
  (`cylinder_t::gas_volume`) and the dive's mean depth - computing that in
  TypeScript would be a second implementation of core physics that could
  disagree with the file. `siteUuid` is ignored, because a preview must not
  touch the site table; the derived values are recomputed unconditionally.
- **`deleteDiveSite`** detaches every dive from the site before destroying it,
  so no `dive::dive_site` pointer is left dangling.
- **`ungroupDives`** unregisters every dive from its trip and empties the trip
  table. It removes *all* trips, including ones a desktop logbook declared:
  `dive_trip::autogen` is in-memory only - neither `save-xml.cpp` nor the parser
  carries it - so a trip an older, autogrouping build wrote into a file cannot
  be told from one the user made. The caller is expected to confirm first; the
  app does, in Settings. `notrip` is left unset, since nothing regroups dives
  once autogrouping is off.

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

`plotPressureAt(pi, sampleIndex, cylinder)` in `src/SsrfCore.types.ts` (also
re-exported from `src/index.ts`) does the indexing and the sensor ->
interpolated fallback. It lives in the types file because it is pure arithmetic
over a reply: the Node test suite imports it without loading the native module.

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

The same binary also speaks a line protocol, which is what the vitest suite
drives (see `tests/harness/ssrf-host.ts` in the repo root):

```sh
printf 'loadFromXML\t{"path":"../../subsurface/dives/test29.xml"}\nlistDives\t{}\n' |
	./build/host/ssrf-smoke repl
```

One request per line, `<method>\t<args-json>`, answered by exactly one line
carrying the envelope. That keeps a single long-lived divelog for a whole test
file, which is the only way a load-then-query sequence can work.
