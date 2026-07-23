# Subsurface Mobile

A new mobile app for [Subsurface](https://subsurface-divelog.org/) dive logs,
built with Expo + @expo/ui, consuming the upstream Subsurface C++ core read-only.

iOS ships first; Android is a later phase.

## Scope (v1)

- Import dives from Suunto (DM/SDE XML) — no libdivecomputer download, no BLE.
- Import/export the Subsurface SSRF XML logbook (`.ssrf` / `.xml`).
- Render the per-dive profile diagram and core statistics.
- Manage buddies and dive sites.

## Architecture

TS / React Native (Expo Router, @expo/ui, react-native-skia) over a native
`ssrf-core` module that owns the in-memory `divelog` and serializes to SSRF XML.
The SSRF file is the source of truth — no separate database.

The upstream C++ core is vendored via the `subsurface/` git submodule, pinned to
a fixed commit and consumed read-only. See
`modules/ssrf-core/cpp/CORE_MANIFEST.md` for the vendored file list and pin.

## Requirements

- Xcode + iOS 26 SDK, a physical iOS device (liquid glass and the native C++
  module do not run in Expo Go or the simulator).
- Node LTS, `git`, CocoaPods.
- Expo dev-client, SDK 54+ (not Expo Go — a custom native module requires
  `expo prebuild` + a dev client).

## Getting started

```sh
git clone --recurse-submodules <this-repo-url>
cd subsurface-mobile
npm install
npx expo prebuild
npx expo run:ios      # onto a physical device
```

## Development conventions

See [CLAUDE.md](CLAUDE.md) for the project invariants. In short: TypeScript
strict, ESLint + Prettier, every new source file starts with
`// AI-generated (Claude)`, no emojis, never edit anything under `subsurface/`.

Implementation is tracked task-by-task in [docs/tasks/](docs/tasks/) —
see [PROGRESS.md](docs/tasks/PROGRESS.md).

## License

GPL-2.0 — the Subsurface core is GPL-2.0, and linking it makes this app a
derivative work. See [LICENSE](LICENSE).
