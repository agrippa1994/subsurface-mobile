# 04 — iOS Native Dependencies

**Goal:** Provide **libxml2**, **libxslt**, and **libzip** to the iOS module build so the
core's XML parse/save and zipped-format import work.

**Prerequisites:** Task 03 (core subset compiles; may currently fail to link due to missing
XML/zip symbols — this task resolves that).

## Background

- The core uses **libxml2** (XML parse/save), **libxslt** (import XSLT filters in
  `subsurface/xslt/`), and **libzip** (zipped formats incl. Suunto `.sde`).
- **iOS ships libxml2** in the SDK (`libxml2.tbd`), so it links for free.
- **libxslt** and **libzip** are **not** in the iOS SDK → build & vendor them.
- Subsurface already cross-compiles these for iOS; reuse its recipes as reference
  (`subsurface/packaging/` and the iOS handling near `subsurface/CMakeLists.txt:174`,
  which adds `${CMAKE_OSX_SYSROOT}/usr/include/libxml2` and does
  `pkg_config_library(LIBXML ...)` / `LIBXSLT`).

## Steps

1. **libxml2 (SDK):**
   - Link `libxml2.tbd`; add `$(SDKROOT)/usr/include/libxml2` to the podspec
     `HEADER_SEARCH_PATHS`.

2. **libxslt + libzip (vendored):**
   - Build each as an **xcframework** for `arm64` (device) and `arm64` (simulator).
     Reuse or adapt Subsurface's iOS cross-build scripts. (libxslt depends on libxml2 —
     point it at the SDK libxml2 headers.)
   - Place the xcframeworks under `modules/ssrf-core/ios/vendor/`.

3. **Wire into the podspec:**
   - `s.vendored_frameworks` for the xcframeworks.
   - `HEADER_SEARCH_PATHS` for their headers; `OTHER_LDFLAGS`/`s.libraries` as needed.
   - Ensure the C++ core's `#include <libxml/...>`, `<libxslt/...>`, `<zip.h>` resolve.

4. **Rebuild:** `npx expo prebuild --clean && npx expo run:ios`.

## Acceptance criteria

- Clean `expo run:ios` build with libxml2/libxslt/libzip resolved.
- A C++ smoke test **parses `subsurface/dives/abitofeverything.ssrf`** via the core and
  reports the correct **dive count** (compare against opening the same file in desktop
  Subsurface, or against the count asserted in `subsurface/tests/testparse.cpp`).

## Notes

- Keep build scripts for the vendored libs in `modules/ssrf-core/ios/vendor/build/` so the
  xcframeworks are reproducible, and record versions in `CORE_MANIFEST.md`.
- If a zipped-format path (e.g. `.sde`) is not needed until task 11, libzip can be stubbed
  temporarily — but libxml2/libxslt are required now.
</content>
