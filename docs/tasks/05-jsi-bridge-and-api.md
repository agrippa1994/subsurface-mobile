# 05 — JSI Bridge & Module API

**Goal:** Expose a clean, typed `ssrf-core` API to JS with **JSON at the boundary**, backed
by the vendored core.

**Prerequisites:** Tasks 03–04 (core compiles, links, parses a file).

## API surface

```ts
// modules/ssrf-core/src/index.ts
loadFromXML(pathOrBuffer: string | ArrayBuffer): void   // parse .ssrf/.xml into in-memory divelog
saveToXML(path: string): void                            // serialize current divelog (atomic write)
listDives(): DiveSummary[]        // { id, when, siteName, maxDepthMm, durationSec, rating }
getDive(id: number): Dive         // full detail: cylinders, weights, tags, buddy, diveguide, dcs
getProfile(id: number): PlotInfo  // sample arrays + events (see below)
getStatistics(filter?: StatsFilter): Stats
importSuunto(buffer: ArrayBuffer): ImportResult  // { added, merged, failed }
listDiveSites(): DiveSite[]       // { uuid, name, lat, lon, description, notes }
upsertDiveSite(site: DiveSiteInput): number       // returns uuid
deleteDiveSite(uuid: number): void
updateDive(id: number, patch: DivePatch): void    // notes/buddy/diveguide/tags/rating/siteUuid
```

## Backing C++ structures (confirm before marshalling)

- **`plot_info`** — `subsurface/core/profile.h:85`. It holds
  `std::vector<plot_data> entry` (one per sample) and `std::vector<plot_pressure_data>
  pressures` (cylinders × samples, indexed via `get_plot_pressure(pi, idx, cyl)`).
  Each `plot_data` (`profile.h:39`) has `sec`, `depth`, `temperature`, `ceiling`,
  `pressures`, `o2setpoint`, `velocity`, etc. Depth/pressure use `depth_t`/`pressure_t`
  (millimetre / millibar integer units — expose raw ints; format in TS).
  Build the profile via `create_plot_info_new(dive, dc, nullptr)` (`profile.h:111`).
- **`dive`** — `subsurface/core/dive.h`. Note `buddy` and `diveguide` are plain
  comma-separated `std::string` (`dive.h:50`); `cylinders`, `weightsystems`, `tags`, `dcs`.
- **`dive_site`** — `subsurface/core/divesite.h:10`: `uuid`, `name`, `location`,
  `description`, `notes`, `taxonomy`.
- **`statistics`** — `subsurface/core/statistics.{h,cpp}` (Qt-free).

## Steps

1. **Confirm exact structs** by reading `profile.h`, `dive.h`, `divesite.h`, `statistics.h`
   in the pinned submodule. Document the JSON key mapping in `modules/ssrf-core/cpp/API.md`.
2. **Implement bindings** in `cpp/bindings/`. Vendor a small JSON lib (e.g. `nlohmann/json`)
   for marshalling; keep large numeric arrays (profile samples) as typed arrays where
   practical to limit copy cost.
3. **In-memory ownership:** the module keeps a single `divelog` instance (loaded by
   `loadFromXML`). All getters read it; `updateDive`/`upsertDiveSite`/`deleteDiveSite`
   mutate it; `saveToXML` serializes it.
4. **Units policy:** return **raw core units** (mm, mbar, seconds, mkelvin) — no locale
   formatting in C++. TS formats for display (task 06/08).
5. **Errors:** surface `report_error` output (from the shim's error buffer) as thrown JS
   errors or a `getLastError()` call.
6. **Update TS wrapper + `types.ts`** to match `API.md` exactly.

## Acceptance criteria

- `loadFromXML("subsurface/dives/test29.xml")` then `listDives()` returns the expected
  dives (count + first dive's date/depth match desktop Subsurface).
- `getProfile(id)` returns a non-empty `entry` array with monotonic `sec` and plausible
  `depth` values; pressures resolve via the documented cylinder indexing.
- `listDiveSites()` returns sites with GPS for a file that has them (e.g. a `dives/*.ssrf`).

## Notes

- `plot_info.pressures` is a flat array indexed `cyl + idx*nr_cylinders`
  (`profile.h:126`); replicate that indexing when flattening to JSON.
- Keep the API **pure w.r.t. display** — all formatting/units live in TS so the same core
  numbers can be shown metric or imperial.
</content>
