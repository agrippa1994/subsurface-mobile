# 02 — Native Module Scaffold

**Goal:** A local Expo module `ssrf-core` that executes **C++ over JSI** with a trivial
function, proving the build/prebuild/dev-client loop before any real core code.

**Prerequisites:** Task 01 complete.

## Background

Expo Modules API is built on **JSI** (same class as Turbo Modules), so C++ can be exposed
with near-zero-copy calls. iOS integrates C/C++ through the module's **podspec**
(`source_files` include `cpp/**`); Android will use Gradle + CMake + NDK (task 13).

## Steps

1. **Create the local module:**
   - `npx create-expo-module --local ssrf-core` → generates `modules/ssrf-core/`.
   - Register it in `app.config.ts` if not auto-linked.

2. **Add a C++ source tree:**
   - `modules/ssrf-core/cpp/ssrfcore.h` / `ssrfcore.cpp` with a trivial
     `int add(int a, int b)`.
   - A JSI installer that binds a JS-callable `add`. Follow the Expo Modules JSI/C++
     integration pattern (a `JSIModule`/host object installed on the runtime).

3. **iOS wiring (podspec):**
   - In `modules/ssrf-core/ios/SsrfCore.podspec`, add
     `s.source_files = "**/*.{h,m,mm,swift}", "../cpp/**/*.{cpp,h,hpp}"` (adjust paths).
   - Set `CLANG_CXX_LANGUAGE_STANDARD` to match core (**C++17 or newer**) and
     `CLANG_CXX_LIBRARY = libc++` in `pod_target_xcconfig`.

4. **TypeScript wrapper:**
   - `modules/ssrf-core/src/index.ts` exports typed functions; start with
     `export function add(a: number, b: number): number`.
   - `modules/ssrf-core/src/types.ts` for shared types (filled out in task 05).

5. **Rebuild & run:** `npx expo prebuild --clean` then `npx expo run:ios`.

## Acceptance criteria

- Calling `SsrfCore.add(2, 3)` from the app returns `5`, executed in **native C++** on the
  device (verify by adding a temporary `printf`/log inside the C++ `add`).
- `npx expo prebuild --clean && npx expo run:ios` succeeds from scratch.

## Notes

- Do not add any Subsurface core files yet — this task only proves the plumbing.
- Keep the JSI install code in one place; task 05 extends it with the real API surface.
</content>
