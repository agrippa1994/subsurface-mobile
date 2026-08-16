# 07 — Navigation & Dive List

**Goal:** Read-only browsing of a loaded SSRF log with a native iOS feel (liquid glass).

**Prerequisites:** Task 05 (API) and enough of task 06 to have TS models.

## Steps

1. **App shell (Expo Router):** tab or split navigation with sections
   **Dives**, **Sites**, **Statistics**, **Settings**. Liquid-glass nav/tool bars via
   `@expo/ui`. Remove/gate the task-01 spike screen.

2. **State layer:** **TanStack Query** over the module — the module is the source of
   truth, the query cache holds what the last `listDives()` returned and every mutation
   invalidates it. Keys live under `['log','data']` so a mutation re-reads the derived
   answers without re-running `loadFromXML`; a load, import or replace *removes* that
   subtree instead, because dive ids are process-local and are reassigned on every load.
   Load a **bundled sample SSRF** (copied to app documents on first run) so there is
   content before the user imports anything.

3. **Dive list:** grouped by **trip** (from `listDives()` + trip info), native
   `@expo/ui` list rows showing date, site, max depth, duration, rating. Sort newest-first.
   Use unit-formatting helpers from task 06 (respect a metric/imperial setting).

4. **States:** loading skeleton, empty state (no dives → prompt to import), error state
   (surface module errors from task 05).

5. **Detail placeholder:** tapping a row navigates to a dive-detail route (fleshed out in
   task 08).

## Acceptance criteria

- Launching the app renders the bundled sample log as a **grouped, scrollable native list**.
- Tapping a dive navigates to the (placeholder) detail screen with the correct dive id.
- List reflects the metric/imperial setting and shows correct depths/durations.
- Empty and error states render correctly (test by loading an empty and a malformed file).

## Notes

- Keep rendering data-driven off the module; no dive parsing in JS.
- Defer editing to task 10 — this screen is read-only.
</content>
