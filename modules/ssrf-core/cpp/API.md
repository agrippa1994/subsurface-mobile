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
| `configure` | `{ xsltDir?, dataDir?, monthNames?, defaultCylinder? }` | `{ xsltDir, dataDir }` |
| `defaultCylinder` | `{}` | `Cylinder` or `null` |
| `listDives` | `{}` | `DiveSummary[]` |
| `getDive` | `{ id }` | `Dive` |
| `getProfile` | `{ id, dcIndex?, gfLow?, gfHigh? }` | `PlotInfo` |
| `getStatistics` | `{ filter? }` | `StatsSummary` |
| `statsChart` | `{ config?, change?, filter?, units?, imperial?, plot? }` | `{ config, options, dives, chart? }` |
| `nitroxPlan` | `{ depthMm, o2Permille, maxPo2Mbar?, salinity?, gfLow?, gfHigh? }` | `NitroxPlan` |
| `surfaceGf` | `{ id?, ambientMbar?, stepSec?, horizonSec?, gfLow?, gfHigh? }` | `SurfaceGfSeries` |
| `planDive` | `PlanInput` | `PlanResult` |
| `savePlan` | `PlanInput` | `{ id, dives }` |
| `gasInfo` | `{ o2Permille, hePermille?, o2Narcotic?, salinity?, surfacePressureMbar?, bestMix? }` | `GasInfo` |
| `plannerOptions` | none | `{ tanks }` |
| `plannerSurface` | `{ altitudeMm }` or `{ surfacePressureMbar }` | `{ surfacePressureMbar, altitudeMm }` |
| `exportDiveCSV` | `{ id, path, format, units?, unitPrefs?, gfLow?, gfHigh? }` | `{ path, format }` |
| `listDiveSites` | `{}` | `DiveSite[]` |
| `upsertDiveSite` | `DiveSiteInput` | `{ uuid }` |
| `deleteDiveSite` | `{ uuid }` | `{ sites }` |
| `addDive` | `NewDiveInput` | `Dive` |
| `previewNewDive` | `NewDiveInput` | `Dive` |
| `updateDive` | `{ id, patch }` | `Dive` |
| `deleteDive` | `{ id }` | `{ dives, trips }` |
| `previewDive` | `{ id, patch }` | `Dive` |
| `ungroupDives` | `{}` | `{ dives, trips }` |
| `listTrips` | `{}` | `Trip[]` |
| `createTrip` | `{ diveIds, location? }` | `Trip` |
| `addDivesToTrip` | `{ diveIds, tripId }` | `Trip` |
| `removeDivesFromTrip` | `{ diveIds }` | `{ trips }` |
| `updateTrip` | `{ id, location?, notes? }` | `Trip` |
| `listMergePairs` | `{}` | `MergePair[]` |
| `previewMerge` | `{ diveIds }` | `{ dive, surfaceIntervalSec, renumberedDives }` |
| `mergeDives` | `{ diveIds }` | `{ id, dives, trips }` |
| `makeFirstDiveComputer` | `{ id, dcIndex }` | `Dive` |
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
  `gfLow` / `gfHigh` are the Buehlmann gradient factors in percent (defaults
  30 / 75, the `default_prefs` values), applied through `set_gf()` before the
  plot is computed. They are clamped to 10-150, and a `gfLow` above `gfHigh`
  raises `gfHigh` to it. `set_gf()` writes a process-global, so they are passed
  on every call rather than configured once: whatever the last `getProfile` set
  is what any later plot would otherwise use.
  Each entry also carries Subsurface's own `ndlCalcSec` / `ttsCalcSec` /
  `stoptimeCalcSec` / `stopdepthCalcMm` / `inDecoCalc`: the plot is computed
  with `prefs.calcndltts` on (restored afterwards). With it on, the core
  overwrites the dive computer's `ndl` with 2h shallower than 3m
  (profile.cpp:789-791), so `ndlSec` is taken from a second, plain pass over
  this dive alone - it comes straight from the samples and does not depend on
  the tissues. The tissues start loaded by the earlier dives, through
  `init_decompression()`; that replay is the costly part of a plot (on a long
  run of daily dives it covers the whole run), so only the main pass sees the
  rest of the log. `surfaceIntervalSec` is the interval `init_decompression()`
  would find - the time since the closest earlier dive (in the same trip, when
  the dive has one) ended, null when none ended within 48h - computed without
  replaying any tissues. For such a dive `fresh` holds the calculated NDL/TTS
  of a third pass with every other dive hidden from it, i.e. as if the diver
  had started with clean tissues.
- **`exportDiveCSV`** writes one dive as CSV with the core's own writers, one
  per CSV entry of desktop Subsurface's export dialog: `format` `"details"`
  (samples, `xml2detailscsv.xslt`), `"summary"` (dive information without the
  profile, `xml2summarycsv.xslt`) or `"profile"` (computed profile panel data,
  `save_profiledata()`). Those writers only export "the selected dives", so the
  selection is set to exactly this dive first. `units` is the stylesheets'
  `0` metric / `1` imperial (default metric); `unitPrefs`, a units object (see
  "Units for core-written text" below), picks each column's unit on its own
  through the patched stylesheets and wins over `units`; `"profile"` ignores both and writes
  raw core units, and takes `gfLow`/`gfHigh` exactly as `getProfile` does. The
  file is written in place, not atomically - it is an export, not the logbook.
- **`nitroxPlan`** reads no logbook state. For one nitrox mix and one depth it
  returns `modMm` (at `maxPo2Mbar`, default 1400) and `contingencyModMm` (at
  1600) from `dive::gas_mod()`, `bestMixPermille` from `dive::best_o2()`, the
  ambient pressure and pO2 at the depth, and `ndlMin` / `airNdlMin`: the
  Buehlmann no-decompression time of a square dive at that depth on the mix and
  on air. The NDL is the loop `calculate_ndl_tts()` runs in `core/profile.cpp`,
  started from surface-saturated tissues: minutes are added until the ceiling
  leaves the surface, and the last minute without one is the answer. `null`
  means no limit within 300 minutes. A scratch `dive` carries the surface
  pressure (1 atm) and `salinity` (10300 sea, 10000 fresh). The gradient
  factors are applied as for `getProfile`, and `prefs.modpO2` is set to the
  working pO2 because `best_o2()` reads it from there.
- **`surfaceGf`** (`cpp/bindings/surface-gf.cpp`) is the live surface
  gradient factor: how desaturated the diver is after a dive and how that goes
  on over the surface interval. It reads the logbook and changes nothing.
  - *Which dive*: `id`, or without it the valid dive with the latest
    `dive::endtime()`. No dive fails the call.
  - *Tissues at the end of the dive*: `init_decompression()` loads what the
    earlier dives left (the same residual nitrogen `getProfile` starts from),
    then the dive's own `create_plot_info_new()` points are walked with the
    profile's `add_segment()` loop (`calculate_deco_information()`: 20 s steps,
    interpolated depth, the gas and dive mode at each point, its o2 pressure).
    `profile.cpp` keeps its deco state private, so it is rebuilt from the same
    inputs with the same calls; `endSurfaceGf` therefore equals the
    `surfaceGf` of the profile's last point (golden test
    `tests/surface-gf.test.ts`). Only the Buehlmann path is rebuilt; VPM-B only
    iterates the gradients, not the tissue loading.
  - *Surface interval*: from `startWhen` (the profile's last point, at or a few
    seconds past `diveEndWhen`) the tissues are stepped forward with
    `add_segment()` on air at `ambientMbar` (500-1100, default the dive's own
    surface pressure), `stepSec` (10-600, default 60) at a time - the call
    `init_decompression()` itself makes for a surface interval. One ambient
    pressure applies to the whole interval.
  - *Surface GF*: `profile.cpp`'s formula at the ambient pressure: the maximum
    over the 16 compartments of `100 * (p_tissue - p_amb) / (M(p_amb) - p_amb)`
    with `M(p) = a + p / b` after `tissue_tolerance_calc()` set each
    compartment's `a`/`b` for its N2/He mix. Like the profile the maximum starts
    at 0, so the value never goes negative. It uses the raw M-value, so the
    gradient factors do not change it; they are still applied (`set_gf()`) so
    the plot built on the way matches `getProfile`.
  - *Thresholds*: `gfZeroSec` is the first point where no compartment is above
    ambient pressure (surface GF 0 %). `cleanSec` is the first point where every
    compartment's inert gas pressure is within 2 % of its equilibrium with air at
    `ambientMbar` (`clear_deco()`); that takes the slowest compartment roughly
    the 48 h after which `init_decompression()` stops counting a dive. Either is
    null when it falls past the series.
  - *Length*: without `horizonSec` the series ends an hour after `cleanSec`,
    at most 72 h; with it, at `horizonSec`. `leadingCompartment` names the
    compartment behind each value. `residualFromSec` is the surface interval
    before the dive when earlier dives loaded it (as `getProfile`'s
    `surfaceIntervalSec`), else null.
- **`planDive`** (`cpp/bindings/planner.cpp`) runs the core's `plan()` the way
  `DivePlannerPointsModel::calculatePlan` does in the Qt app: cylinders, then
  `reset_cylinders()`, then a zero-time waypoint for each open circuit gas with a
  switch depth, then the segments. It changes nothing in the log, but
  `init_decompression()` reads the dives before `when`, so a repetitive plan starts
  from the tissues they left, and `surfaceIntervalSec` goes negative on an overlap.
  Every setting is an argument: the call starts from `default_prefs`, applies
  them, and restores `prefs` on the way out. `units` (or the older `imperial`)
  picks the stop table, 3 m or 10 ft from the depth unit, and the units of the notes. With `dropStone`, the first segment's descent at
  `descrate` is carved out of its time, and a segment shorter than that descent is
  refused. `o2Permille` is taken as given, and 0 is the core's air. A first segment
  on another cylinder moves that cylinder to the front; `inputIndex` says which is
  which. `error` is `plan()`'s result. On `timeout`, `inappropriateGas` and
  `noSuitableBailoutGas` there is no ascent: `profile` and `dive` are null and the
  notes hold the reason. `recreationalExceedsNdl` keeps them, so the diver sees why.
  `displayVariations` runs `plan()` five more times, as `computeVariations` does, and
  puts the result where the notes had the token `VARIATIONS`. `showIcd` defaults to
  on, unlike the core, because the isobaric counterdiffusion warning depends on it.
- **`savePlan`** runs `plan()` again with the disclaimer in the notes and adds the
  dive as `Command::AddDive` does, renumbering nothing else. The dive computer model
  is the core's `planned dive`, so `planned` is true on the dive after a round trip.
  It refuses every error, `recreationalExceedsNdl` included.
- **`gasInfo`** gives the MOD from `dive::gas_mod()` at the pO2 steps of the legacy
  gas calculator, and the END or EAD there by the formula in
  `calculate_gas_information_new()`. `bestMix` adds `dive::best_o2()` and
  `best_he()`, with the helium capped so the mix adds up to 100%.
- **`plannerOptions`** is `default_tank_info_table()`, sizes in ml at the working
  pressure. **`plannerSurface`** is `altitude_to_pressure()` and
  `pressure_to_altitude()`, clamped to 689-1100 mbar and sea level.
- **`statsChart`** is the desktop's chart configurator. `config` is a `StatsState` as JSON
  (variables by name, binners by index into their list, enums by name, so reordering
  upstream does not move a saved chart); a partial or unknown one completes as `StatsState`
  would. It is replayed through `var1Changed()` and friends, then `change`, one user choice,
  is applied, so `validate()` is what constrains the choices. `config` in the reply is what
  to persist; it replays to itself. `options` is `getUIState()`: only what these choices
  allow. `chart` is the data half of `StatsView::plot*()`: `family` (`bar`, `pie`, `box`,
  `scatter`, or `empty` when nothing is left to draw), axes, and items with the ids of their
  dives, in the units `units` (or the older `imperial`) asks for, which also pick the binners. `filter` is
  `getStatistics`' and selects dives the same way; `excludePlanned` applies to both. The
  regression is `linear_regression()` and is null when upstream draws none, because the fit
  is not significant. See `cpp/bindings/stats-chart.cpp`.
- **`getStatistics`** marks the dives matching `filter` as `selected` (that is
  the input the core's statistics code takes) and then calls
  `calculate_stats_summary(true)` and `calculate_stats_selected()`. The
  selection is left in place afterwards; the only other reader is
  `exportDiveCSV`, which sets it itself.
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
  - `firstWhen`, `lastWhen`, `nitroxDives` (a cylinder richer than 21% O2) and
    `deepDives` (deeper than 39 m): the legacy dive summary's other rows
    (`qt-models/divesummarymodel.cpp`, `calculateDive`), over the same selection.

  The filter's `recentMonths` is the legacy summary's period: the dives strictly
  after "now less that many calendar months", now being the wall clock dives are
  logged in (`time(nullptr) + gettimezoneoffset()`, or `nowWhen` for a test), the
  day clamped to the shorter month as `QDateTime::addMonths` does
  (`months_before()` in `api.cpp`). `periodStartWhen` on the reply is that start,
  0 without a period. It combines with every other filter field.
- **`addDive`** is upstream's `Command::AddDive` without the undo stack and with
  autogrouping off, on a dive built like `dive_table::default_dive()`: a dive
  computer called "manually added dive" (`make_manually_added_dive_dc`), and six
  or fewer samples from `fake_dc()`. `when`, `durationSec` and `maxDepthMm` are
  required, every other key is as in a `DivePatch`. The number is
  `get_dive_nr_at_idx()`'s unless given: the next one at the end of the log, 0 in
  the middle of it. The dive joins no trip, whatever dates it falls between. No
  default cylinder is added: the core's has no pressures, so gives no SAC, and
  says "unknown". `previewNewDive` returns the same dive without adding it.
- **`updateDive`** applies only the keys present in `patch`, then calls
  `dive::invalidate_cache()` because the full-text cache indexes notes, buddy
  and tags. `siteUuid: 0` detaches the dive from its site.

  `when`, `airTempMkelvin` and `waterTempMkelvin` go for any dive; a date also sets
  the first computer's, as legacy's `checkDate` does, and sorts the tables, as
  `Command::EditDive` does. The dive stays in its trip and keeps its number.
  `durationSec`, `maxDepthMm` and `meanDepthMm` are refused unless the first
  computer is the manual one, since elsewhere they come from the samples; they
  replace the samples through `fake_dc()`. Without `meanDepthMm`, a new depth or
  duration clears the average first (`EditDepth`, `EditDuration`). Ranges: a date
  before 2030, which the core's date parser cannot read past; depth 1 m to 500 m;
  duration up to 24 h. Any of these runs `fixup_dive()`.

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

  `patch.weightsystems` follows the same whole-list contract, with two
  differences. Nothing else in a dive refers to a weightsystem - no samples, no
  events - so any of them can be removed and there is no renumbering to do. And
  nothing derived depends on the weight carried, so there is no recomputation
  either; `dive::total_weight()` sums on demand. An entry that names
  `weightGrams` clears `weightsystem_t::auto_filled`, because a weight the diver
  typed is no longer one derived from the type; an entry carrying only
  `sourceIndex` leaves the flag alone. New entries are passed to
  `add_weightsystem_description()` so `ws_info_table` learns the type.
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
- **Trip methods** do to the core what the Qt undo commands do
  (`commands/command_divelist.cpp`, `command_edit_trip.cpp`), through the same
  core functions. A trip goes away with its last dive, location and notes
  included. `diveIds` is resolved before anything changes, so a stale id fails
  the whole call. `createTrip` names the trip after the site of the oldest dive
  (`create_trip_from_dive`) unless `location` is given. `addDivesToTrip` moves a
  dive that is in another trip. `removeDivesFromTrip` sets `notrip`, as the
  command does: desktop Subsurface will not autogroup that dive again.
  `listTrips` leaves out a trip with no dives, which only a file with an empty
  `<trip>` can produce and which saving drops. Trip ids are process-local, like
  dive ids. Dives carry `tripId` (0 for no trip).
- **`getStatistics`** takes `tripId` in its filter, which is how a trip gets its
  totals from `statistics.cpp`.

- **`mergeDives`** does what the `MergeDives` command of
  `commands/command_divelist.cpp` does around `dive_table::merge_dives()`: the
  merged dive takes the first non-zero number, later dives close the gap in the
  numbering when both ends are numbered in order, the core picks the trip and the
  site, and a site without GPS gets the first location among the sources. The
  merged dive has a new id. A trip losing its last dive goes away; a site does
  not. There is no undo. The dives must be neighbours in the table and no more
  than 30 minutes apart, the rule of `QMLManager::canMerge()`, which is stricter
  than the desktop's warning. `listMergePairs` answers that rule for every pair,
  and `previewMerge` returns the dive a merge would make without changing anything.
  A dive whose gas change or sensor mapping names a cylinder it does not have is
  refused: the core's renumbering would read out of bounds on it.

- **`makeFirstDiveComputer`** is desktop's "Make first dive computer"
  (`MoveDiveComputerToFront` of `commands/command_divelist.cpp`): a copy made by
  `clone_make_first_dc()` with computer `dcIndex` moved to the front replaces the
  dive in the table, in the same trip and at the same site. The dive keeps its id.
  Everything that reads the first computer (the summary's mode, SSI upload, the
  CSV export, the default profile) then reads this one; the order is saved in the
  file. `dcIndex` 0 changes nothing and leaves no undo step; an index out of range
  fails. Undoable like every other mutation.

### Downloading from a dive computer

Runs on a thread of its own, into a log of its own. Nothing reaches the module's divelog
until `dcDownloadAccept`, and then it still has to be saved.

| Method | Args | Result |
| --- | --- | --- |
| `dcListComputers` | | `[{ vendor, products: [string] }]`: what has BLE, sorted |
| `dcDetect` | `{ name }` | `{ vendor, product }` or `null`, from a Bluetooth name |
| `dcDownloadStart` | `{ vendor, product, address, btName?, force?, syncTime? }` | `{}`. Fails if one is running, or the product has no BLE |
| `dcDownloadStatus` | | `DownloadStatus`, see `src/SsrfCore.types.ts` |
| `dcDownloadCancel` | | `{}`. Takes effect within 50 ms of the stream's next wait |
| `dcDownloadAccept` | `{ indices: [int] }` | as `importFile`: merges those, drops the others, ends the session |
| `dcDownloadDiscard` | | `{}` |
| `bleScanStart` | `{ knownAddresses? }` | `{}` |
| `bleScanStop` | | `{}` |
| `bleScanStatus` | | `{ adapter, scanning, available, devices }` |
| `configure` | `{ dataDir }` | Where the fingerprint cache and `libdivecomputer.log` go; without it, neither is written |

Between calls the module pushes `onCoreEvent` with `{ json }`, parsed by
`addCoreEventListener`: `{ type: 'download', state, text, fraction }`, and
`{ type: 'ble', adapter? , device? }`. An event is a hint to re-read the status, which is
what the screen does once a download has ended.

A download that failed or was cancelled can still hold the dives that came through.

The host's `repl` also takes `sim.configure`, `sim.status` and `sim.selectService`, for the
simulated dive computer in `tests/fake-dive-computer.cpp`.

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

## Undo and redo

`cpp/bindings/history.cpp` wraps the dispatch: a method it does not list as leaving
the log alone counts as a change. If the log serializes differently afterwards, the
call becomes an entry in the history, so a new mutation has undo with no code here.

| Method | Args | Result |
| --- | --- | --- |
| `undo` | none | `{ entry, idsKept, state }`; fails when there is nothing to undo |
| `redo` | none | as `undo` |
| `historyState` | none | `{ canUndo, canRedo, undo, redo, undoDepth, redoDepth, bytes, revision, lastAction }` |
| `clearHistory` | none | the state |

- Any reply whose call changed the history carries the new state as a top-level
  `history` key, next to `result`. `src/index.ts` passes it to `subscribeHistory`.
- `loadFromXML` and `clear` forget the history: what they replace it with is not the
  logbook it was the history of.
- Dive and trip ids survive `undo` and `redo`, so a screen or a cached query on an id
  is still right if the dive exists. A restored dive has its old id. `idsKept: false`
  would mean they could not be put back, and every id has to be treated as new.
- Any method may be given `historyKind`, a string filing the entry under that `kind`.
- At most 50 entries are kept, and 64 MB of states, always at least one entry.

## Units for core-written text

Everything the bindings return is in raw core units, but three outputs are text the
core writes itself: the planner's notes, the configurable statistics (binner names,
labels, axis titles) and the CSV stylesheets. Those calls take `units`, one unit per
quantity, the app's `Units` (src/models/units.ts):

```json
{ "depth": "m" | "ft", "pressure": "bar" | "psi", "volume": "l" | "cuft",
  "temperature": "C" | "F", "weight": "kg" | "lbs" }
```

It sets `prefs.units` for that call only (`units_from_json`, marshal.cpp), and
`prefs.unit_system` to METRIC, IMPERIAL or PERSONALIZE as desktop derives it. A
quantity left out keeps the preset (`imperial`, else metric); any other value is an
error. The older `imperial: true` remains and means every unit imperial.

## Month names

`configure({ monthNames })` takes the device region's twelve short month names,
January first. The core spells a month in two places the app shows - the
configurable statistics' monthly binner and a trip's title, both through
`monthname()` - and the gettext shim (cpp/shim/gettext.cpp) maps the English
"Jan".."Dec" to these. An empty name keeps the English one. Every other date the
app shows is formatted in TypeScript (src/models/date-format.ts).

## Default cylinder

`configure({ defaultCylinder })` sets the core's `prefs.default_cylinder` to a cylinder
type's name from the tank table (`plannerOptions().tanks`), or `""` for none, the
core's default. A name the table lacks is refused and leaves the previous one; the
table is rebuilt first (`reset_tank_info_table`) in case no log has been loaded yet.
The core reads it where desktop does: `fill_default_cylinder()` for a downloaded
dive's cylinder that the computer named without a size. `defaultCylinder` returns
`create_new_cylinder()` on a scratch dive - the type's size and working pressure,
filled to it, air - which the app starts a new dive's cylinder and the planner's
cylinders from; `null` when none is set.

