# 13 — Android Parity (Later Phase)

**Goal:** Bring the `ssrf-core` module and the UI to Android at feature parity with iOS v1.

**Prerequisites:** iOS v1 shipped (tasks 01–12). Do not start until the module + UI are
proven on iOS.

## Steps

1. **Android native module build (Gradle + CMake + NDK):**
   - Add `modules/ssrf-core/android/CMakeLists.txt` compiling the **same core subset** from
     task 03; point `build.gradle` at it. Register the JSI module via an `OnLoad.cpp`.
   - Reuse the de-Qt shim and patches unchanged (they are platform-agnostic C++).

2. **Cross-compile native deps for Android NDK** (none ship with the NDK):
   - Build **libxml2**, **libxslt**, **libzip** for `arm64-v8a` (+ `x86_64` for emulators).
     Reuse Subsurface's Android build recipes (`subsurface/packaging/android*`,
     `subsurface/android*`) as reference. Bundle as prebuilt `.so`/`.a` per ABI.

3. **UI adaptation:**
   - Adapt `@expo/ui` screens to **Material** conventions where iOS-specific (liquid glass →
     Material surfaces). Verify navigation, lists, charts, map, share/import intents.
   - Android **file intents**: `ACTION_VIEW`/`ACTION_SEND` for `.ssrf`/`.xml`.

4. **QA:** run the golden **round-trip + profile** tests (task 06) on Android; manual pass
   of import → browse → profile → stats → edit → export.

## Acceptance criteria

- Feature parity with iOS v1 on a physical Android device.
- Round-trip and profile tests **green on Android**.
- Import/export via Android share/intents works; exported SSRF re-opens in desktop
  Subsurface.

## Notes

- The C++ core, shim, patches, and bindings are shared — only the build system, native-dep
  packaging, and platform UI conventions differ.
- Budget ~4–8 person-weeks; the native-dep cross-compile is the main cost.
</content>
