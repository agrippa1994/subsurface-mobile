# Subsurface Mobile — Implementation Task Set

This directory contains a **step-by-step implementation guide** for building a new
Subsurface mobile app with Expo. Each `NN-*.md` file is a self-contained task an AI (or
human) executes in order. Do them **sequentially** unless a file says otherwise; each ends
with **Acceptance criteria** that must pass before moving on.

## Order

| # | Task | Theme |
|---|------|-------|
| 00 | [overview-and-conventions](00-overview-and-conventions.md) | Read first — invariants |
| 01 | [repo-and-expo-skeleton](01-repo-and-expo-skeleton.md) | Repo + Expo dev-client |
| 02 | [native-module-scaffold](02-native-module-scaffold.md) | Empty JSI module |
| 03 | [vendor-core-and-de-qt-shim](03-vendor-core-and-de-qt-shim.md) | Compile the C++ core |
| 04 | [ios-native-deps](04-ios-native-deps.md) | libxml2 / libxslt / libzip |
| 05 | [jsi-bridge-and-api](05-jsi-bridge-and-api.md) | Module API |
| 06 | [ts-models-and-vitest](06-ts-models-and-vitest.md) | TS types + tests |
| 07 | [ui-navigation-and-dive-list](07-ui-navigation-and-dive-list.md) | Browsing UI |
| 08 | [dive-detail-and-profile-skia](08-dive-detail-and-profile-skia.md) | Profile diagram |
| 09 | [statistics](09-statistics.md) | Stats charts |
| 10 | [editing-divesites-buddies](10-editing-divesites-buddies.md) | Mutations |
| 11 | [suunto-and-ssrf-io](11-suunto-and-ssrf-io.md) | Import/export |
| 12 | [polish-and-testflight](12-polish-and-testflight.md) | iOS beta |
| 13 | [android-parity](13-android-parity.md) | Android (later) |

Track status in [PROGRESS.md](PROGRESS.md).

## Reference checkout

Tasks reference the upstream Subsurface source by path (e.g. `core/parse-xml.cpp`). Those
paths are relative to the Subsurface repository, added to this project as a git submodule
at `subsurface/` (see task 01). Do **not** modify anything under `subsurface/` — it is
consumed read-only. All new code lives in this repo and is marked `// AI-generated (Claude)`.
</content>
