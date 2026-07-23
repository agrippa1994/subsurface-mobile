# 10 — Editing: Dives, Dive Sites, Buddies

**Goal:** Mutations that persist back to the SSRF file (the source of truth).

**Prerequisites:** Task 05 (`updateDive`, dive-site CRUD), task 07/08 (screens).

## Steps

1. **Dive edit** via `updateDive(id, patch)`:
   - Notes, rating, tags, water conditions.
   - **Buddy** and **diveguide** are comma-separated `std::string` fields
     (`subsurface/core/dive.h:50`). UI: a token/text field with **autocomplete** over the
     set of existing names harvested from the loaded log (build the suggestion list in TS
     from `listDives()`/`getDive`).

2. **Dive-site management** via `listDiveSites` / `upsertDiveSite` / `deleteDiveSite`:
   - List, create, edit (name, description, notes, GPS), delete.
   - **Map picker** for GPS (`dive_site.location`); associate a dive with a site
     (`patch.siteUuid`).
   - Handle merge/duplicate sensibly (see `subsurface/core/divesite.cpp` `merge`).

3. **Persistence:** after every mutation, the module re-serializes via `saveToXML` using an
   **atomic write** (write temp file, `fsync`, rename). Debounce rapid edits.

4. **Undo (optional, nice-to-have):** keep the previous serialized buffer to allow a single
   undo; not required for acceptance.

## Acceptance criteria

- Edit a **buddy** and move a dive to a **new dive site**; force-quit and relaunch → both
  changes are **persisted** (loaded from the SSRF file, not cached in JS).
- Create, edit, and delete a dive site with GPS; the map shows the correct location.
- The exported file **re-opens in desktop Subsurface** with the edits intact and nothing
  else corrupted (spot-check unrelated dives/sites).

## Notes

- All mutation goes through the module so the in-memory `divelog` and the file stay in sync.
- Never write partial files — atomic rename only, to avoid corrupting the source of truth.
</content>
