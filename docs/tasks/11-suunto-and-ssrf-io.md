# 11 — Suunto Import & SSRF Import/Export

**Goal:** Import Suunto dives and import/export SSRF logs through the OS (Files / share
sheet / AirDrop).

**Prerequisites:** Task 05 (`importSuunto`, `saveToXML`), task 04 (libzip for `.sde`),
task 01 (document types registered).

## Steps

1. **Suunto import** via `importSuunto(buffer)` → `subsurface/core/import-suunto.cpp`:
   - Accept Suunto DM/SDE XML (and `.sde` zip if libzip is wired). The core decodes the
     base64 `ProfileBlob` / `PressureBlob` / `TemperatureBlob` sample data (see the sample
     `subsurface/dives/Dive_2013-02-02-1614.xml`).
   - Show an **import summary**: added / merged / failed (from `ImportResult`).
   - Imported dives merge into the current in-memory `divelog`, then `saveToXML`.

2. **SSRF import:** pick a `.ssrf`/`.xml` via `expo-document-picker`; `loadFromXML` (replace
   or merge — offer both). Persist.

3. **SSRF export:** `saveToXML` to a temp file, then share via `expo-sharing` (share sheet /
   Files / AirDrop). Ensure the registered UTIs (task 01) let other apps hand `.ssrf`/`.xml`
   to this app ("Open in…").

4. **Open-in handling:** register for incoming `.ssrf`/`.xml` files so tapping one in Files
   or Mail imports it.

## Acceptance criteria

- Import `subsurface/dives/Dive_2013-02-02-1614.xml`; the dive appears with a **decoded
  profile** (samples/temperature/pressure), verifying blob decoding worked.
- Export the current log and **re-open it in desktop Subsurface** — round-trips cleanly.
- "Open in…" a `.ssrf` from Files imports it into the app.

## Notes

- `.sde` is a zip of Suunto XML — requires libzip (task 04). If libzip was deferred, wire it
  here.
- Keep import idempotent-ish: merging the same file twice should merge, not duplicate
  (rely on the core's dive de-duplication).
</content>
