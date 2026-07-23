# 08 — Dive Detail & Profile Diagram (Skia)

**Goal:** A dive detail screen and the per-dive **profile diagram**, rendered with
`react-native-skia` from the core's `plot_info`.

**Prerequisites:** Task 07 (navigation) and task 05 (`getProfile`).

## Steps

1. **Dive detail** from `getDive(id)`:
   - Header (date, site, duration, max/mean depth, rating, water temp).
   - Cylinders (gas mix, start/end pressure), weights, tags, **buddy** & **diveguide**,
     notes. Use unit-formatting helpers (task 06).

2. **Profile diagram** with `react-native-skia`, driven by `getProfile(id)` →
   `PlotInfo.entry[]`:
   - **Depth curve** (inverted Y: 0 at top), filled under the curve.
   - **Temperature** line/series, **tank pressure** line(s) per cylinder
     (resolve via the flat `pressures` indexing: `cyl + idx*nr_cylinders`).
   - **Deco ceiling** (`plot_data.ceiling`) shaded where `in_deco`.
   - **Event markers** (gas changes, warnings) at their `sec` positions.
   - Time X-axis + depth Y-axis with gridlines and labels.
   - Use `subsurface/profile-widget/` only as a reference for **what** to draw (curves,
     axes, colors), not how (that code is Qt).

3. **Interaction:** pinch-to-zoom and pan along time; a scrubber that reads the sample at a
   time (optionally via `get_plot_details_new`, `profile.h:153`) into a readout box.

4. **Theming:** theme-aware colors (light/dark); follow the `dataviz` skill for palette and
   mark specs before choosing colors.

## Acceptance criteria

- The profile for a **Suunto-imported** dive matches the **shape** shown by desktop
  Subsurface for the same dive (depth envelope, key events at correct times).
- Temperature and tank-pressure series render and track the depth curve.
- Zoom/pan and the scrubber readout work smoothly on device.

## Notes

- Depths are millimetres and pressures millibars — scale in the renderer, don't mutate core
  data.
- For dives with multiple divecomputers, render the primary `dc` first; multi-DC selection
  can come later.
</content>
