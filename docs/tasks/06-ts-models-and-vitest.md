# 06 — TS Models & vitest Harness

**Goal:** TypeScript domain types mirroring the module API, plus a **golden-file test
harness** that proves parity with the C++ core.

**Prerequisites:** Task 05 (API implemented).

## Steps

1. **Domain types** in `src/models/`:
   - `Dive`, `DiveSummary`, `DiveSite`, `PlotInfo`, `PlotSample`, `Stats`, `ImportResult`,
     `DivePatch`. Mirror `modules/ssrf-core/cpp/API.md` exactly (raw units — mm, mbar, s,
     mkelvin). Add small pure helpers for unit formatting (mm→m/ft, mbar→bar/psi,
     mkelvin→°C/°F) with unit tests.

2. **vitest setup:**
   - Add `vitest`; configure a test project that can call the native module. Two options,
     pick per feasibility:
     - **(a) C++ test target:** compile the bindings + core into a small host binary and
       drive it from vitest via a thin N-API/child-process shim; or
     - **(b) Node JSI harness:** load the module's C++ as a Node addon exposing the same
       functions. Prefer whichever reuses the exact bindings from task 05.

3. **Golden fixtures:** point tests at `subsurface/dives/` (e.g. `test29.xml`,
   `test15.xml`, `abitofeverything.ssrf`, `Dive_2013-02-02-1614.xml`). Adapt expected
   values from `subsurface/tests/testparse.cpp` (dive counts, first/last dates, depths,
   cylinder pressures, site names).

4. **Round-trip test (critical):** for each fixture:
   `loadFromXML(f)` → `saveToXML(tmp)` → `loadFromXML(tmp)` → assert the two in-memory
   models are **deep-equal** (via `listDives`+`getDive`+`listDiveSites` snapshots).

5. **Profile sanity test:** `getProfile(id)` for a Suunto-imported dive has samples whose
   max depth and duration match the dive summary within tolerance.

6. **CI:** run `vitest` in GitHub Actions (macOS runner for the native build).

## Acceptance criteria

- `vitest` is green: unit formatting tests + golden parse assertions + round-trip deep-equal
  across all chosen fixtures.
- Round-trip is **stable** (a second save produces structurally identical output).
- Any parity gap vs. desktop is either fixed in the shim (task 03) or documented as a known
  limitation in PROGRESS.md.

## Notes

- Round-trip diffs usually trace back to shim formatting (dates/units) — fix there, not by
  loosening assertions.
- Keep fixtures referenced from the submodule; do not copy dive files into this repo.
</content>
