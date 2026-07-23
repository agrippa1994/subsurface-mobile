# 09 — Statistics

**Goal:** An aggregate statistics screen from the core's Qt-free `statistics.cpp`.

**Prerequisites:** Task 05 (`getStatistics`) and task 08 (Skia charting established).

## Steps

1. **Data:** call `getStatistics(filter?)`. Confirm the available aggregates by reading
   `subsurface/core/statistics.{h,cpp}` and the categories used by `subsurface/stats/`
   (rendering only — reuse its *categories*, not its Qt code).

2. **Charts** (react-native-skia / Victory Native). **Read the `dataviz` skill first** for
   palette, mark specs, and light/dark rules. v1 set:
   - **Dives over time** (per month/year bar or line).
   - **Depth distribution** (histogram).
   - **Duration distribution** (histogram).
   - Summary tiles: total dives, total bottom time, max depth, distinct sites.

3. **Filters:** year and dive-site filters feeding the `StatsFilter`.

4. **States:** empty (no dives) and single-dive edge cases.

## Acceptance criteria

- Summary totals match a **hand count** on a known sample log.
- Charts render correctly in **light and dark** themes and are accessible (labelled axes,
  colorblind-safe palette per the `dataviz` skill).
- Filters recompute via the module (not by filtering in JS).

## Notes

- Keep aggregation in C++ (`statistics.cpp`) to stay consistent with desktop; TS only
  renders.
</content>
