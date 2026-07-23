# 00 — Overview & Conventions

**Read this before any other task.** It defines invariants that apply everywhere.

## What we are building

A brand-new **Subsurface mobile app** using **Expo + @expo/ui**, following OS conventions
(liquid glass on iOS 26). The existing Subsurface **desktop app is untouched** — we only
*consume* its C++ core. iOS ships first; Android is a later phase (task 13).

v1 scope:
- Import dives from **Suunto** (DM/SDE XML). **No libdivecomputer download. No BLE.**
- **Import/export** the Subsurface **SSRF XML** logbook (`.ssrf` / `.xml`).
- Render the per-dive **profile diagram** and **core statistics**.
- Manage **buddies** and **dive sites**.

## Architecture (fixed decisions)

```
TS / React Native  (Expo Router, @expo/ui, react-native-skia)
        │  JSI  (JSON at the boundary)
        ▼
 ssrf-core  native module   ── owns the in-memory `divelog`
   de-Qt shim  +  parse-xml / save-xml / parse
   import-suunto  +  profile / deco / statistics
        │ links
        ▼
 libxml2 (iOS SDK), libxslt, libzip, libdivecomputer (static C, no BLE)
```

- **The native module owns the state.** It holds the parsed in-memory `divelog` (exactly
  how the C++ core already works) and serializes to XML. TS is a view/controller layer.
- **SSRF file is the source of truth.** No SQLite / no separate DB. Every mutation
  re-serializes the log to disk (atomic write).
- **Reuse, don't reimplement.** The hard C++ (XML parser, Suunto blob decode, deco/profile
  math) is reused as-is. Only glue (shim + bindings) and the whole UI are new.

## Why the C++ core is reusable

The core is modern C++ already migrated off Qt (`std::string`/`std::vector`/`std::array`).
The hardest-to-replace files are Qt-free:
`core/dive.cpp`, `divelog.cpp`, `divelist.cpp`, `divesite.cpp`, `parse-xml.cpp` (51K),
`save-xml.cpp`, `parse.cpp`, `import-suunto.cpp`, `profile.cpp` (57K), `deco.cpp`,
`statistics.cpp`. Qt coupling (≈69/195 core files) sits in BLE/serial, device download,
cloud/git, image/video, and a few helpers — all shimmed out or excluded.

Two known Qt leaks the shim must handle (task 03):
- Some otherwise-Qt-free **headers tail-include Qt**, e.g. `core/divesite.h:37-39`
  (`#include <QObject>` + `Q_DECLARE_METATYPE(dive_site *)`). These must be patched out.
- Helper headers (`qthelper.h`, `format.h`, `string-format.h`, `gettext.h`) are pulled in
  by engine files; provide non-Qt implementations of only the symbols actually referenced.

## Conventions (apply to every task)

- **Expo dev-client**, SDK **54+**. **Not** Expo Go — a custom native C++ module requires
  `expo prebuild` + a dev client.
- **TypeScript strict**. ESLint + Prettier. **Expo Router** for navigation.
- Every new source file begins with a comment `// AI-generated (Claude)` (repo policy;
  see the upstream `CLAUDE.md`). **No emojis** in code, comments, or commit messages.
- Keep commits small and focused; explain what and why.
- Upstream core is pinned as a **git submodule** at a fixed commit. Never edit files under
  `subsurface/`. If a core file needs a change to build, do it via the **shim** or a
  **patch file** applied at build time, never by editing the submodule in place.
- Maintain `modules/ssrf-core/cpp/CORE_MANIFEST.md`: every vendored/compiled core file and
  the pinned upstream commit, so drift is auditable.

## Definition of done (whole project)

All task acceptance criteria pass **plus** the global verification:
1. **Round-trip parity** with the C++ core across every file in `subsurface/dives/`.
2. **vitest** green (models + module-driven golden tests; expectations adapted from
   `subsurface/tests/testparse.cpp`).
3. **Interop**: export an SSRF file from the app and open it unchanged in desktop Subsurface.
4. **On-device**: a dev-client build renders profile + statistics for a Suunto-imported log.

## Licensing (confirm before public release)

Subsurface core is **GPL-2.0**. Linking it makes this app a derivative work that must ship
**GPL-2.0**. Subsurface already ships an iOS app, so App Store distribution is feasible —
but confirm the GPL-vs-store terms and keep this repo licensed GPL-2.0.
</content>
