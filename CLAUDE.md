# Claude Guidelines — Subsurface Mobile

Invariants for every task in this project. Derived from
`docs/tasks/00-overview-and-conventions.md` (read that file first). These rules
OVERRIDE default behavior and apply to all tasks 01–13.

## What we are building

A brand-new Subsurface mobile app using **Expo + @expo/ui**, following OS
conventions (liquid glass on iOS 26). The existing Subsurface **desktop app is
untouched** — we only *consume* its C++ core. iOS ships first; Android is a
later phase (task 13).

v1 scope:
- Import dives from **Suunto** (DM/SDE XML). No libdivecomputer download. No BLE.
- Import/export the Subsurface **SSRF XML** logbook (`.ssrf` / `.xml`).
- Render the per-dive **profile diagram** and **core statistics**.
- Manage **buddies** and **dive sites**.

## Architecture (fixed decisions)

- **The native module owns the state.** `modules/ssrf-core` holds the parsed
  in-memory `divelog` (exactly how the C++ core works) and serializes to XML. TS
  is a view/controller layer. JSON is the JSI boundary format.
- **SSRF file is the source of truth.** No SQLite, no separate DB. Every mutation
  re-serializes the log to disk (atomic write).
- **Reuse, don't reimplement.** The hard C++ (XML parser, Suunto blob decode,
  deco/profile math) is reused as-is. Only glue (shim + bindings) and the UI are
  new.

## Hard invariants

- **Never edit anything under `subsurface/`.** It is a git submodule, pinned to a
  fixed upstream commit, consumed read-only. If a core file needs a change to
  build, do it via the **shim** or a **build-time patch file** — never in place.
- Maintain `modules/ssrf-core/cpp/CORE_MANIFEST.md`: every vendored/compiled core
  file plus the pinned upstream commit, so drift is auditable.
- **Expo dev-client**, SDK **54+**. Not Expo Go — a custom native C++ module
  requires `expo prebuild` + a dev client.
- **TypeScript strict**. ESLint + Prettier. **Expo Router** for navigation.
- Every new source file begins with `// AI-generated (Claude)` (repo policy).
- **No emojis** in code, comments, or commit messages.
- Keep commits small and focused; explain what and why.
- License is **GPL-2.0** (linking the GPL-2.0 core makes this a derivative work).

## Two known Qt leaks the shim must handle (task 03)

- Some otherwise-Qt-free headers tail-include Qt, e.g. `core/divesite.h:37-39`
  (`#include <QObject>` + `Q_DECLARE_METATYPE(dive_site *)`). Patch these out.
- Helper headers (`qthelper.h`, `format.h`, `string-format.h`, `gettext.h`) are
  pulled in by engine files; provide non-Qt implementations of only the symbols
  actually referenced.

## Definition of done (whole project)

All task acceptance criteria pass plus global verification:
1. **Round-trip parity** with the C++ core across every file in `subsurface/dives/`.
2. **vitest** green (models + module-driven golden tests; expectations adapted
   from `subsurface/tests/testparse.cpp`).
3. **Interop**: export an SSRF file from the app and open it unchanged in desktop
   Subsurface.
4. **On-device**: a dev-client build renders profile + statistics for a
   Suunto-imported log.

## Task workflow

Tasks in `docs/tasks/NN-*.md` are executed **in order**; each ends with
**Acceptance criteria** that must pass before moving on. Track status in
`docs/tasks/PROGRESS.md`.
