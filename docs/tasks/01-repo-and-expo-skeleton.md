# 01 — Repo & Expo Skeleton

**Goal:** A new repo with a running Expo **dev-client** app on a physical iOS device, and
the target look (liquid glass) validated with a throwaway spike screen.

**Prerequisites:** Xcode + iOS 26 SDK, a physical iOS device (liquid glass and the native
module do not run in Expo Go), Node LTS, `git`, CocoaPods.

## Steps

1. **Initialize the repo.**
   - `git init` in `subsurface-mobile/`.
   - Add `LICENSE` (GPL-2.0, matching upstream), `README.md`, `.gitignore`
     (node, Expo, iOS `Pods/`, `ios/`, `android/` build artifacts).

2. **Create the Expo app** (SDK 54+, TypeScript, Expo Router):
   - Scaffold with the current Expo TypeScript + Router template.
   - Add dependencies: `expo-dev-client`, `@expo/ui`, `@shopify/react-native-skia`,
     `expo-document-picker`, `expo-sharing`, `expo-file-system`.
   - Enable TypeScript strict mode in `tsconfig.json`.

3. **Add the upstream core as a submodule** (read-only source of the C++ core):
   - `git submodule add <subsurface-repo-url> subsurface`
   - Pin to a known-good commit. At authoring time upstream was at `e412ccb85`
     ("Import: Fix Bluetooth 'Auto' Mode."). Record the pinned commit in
     `modules/ssrf-core/cpp/CORE_MANIFEST.md` (created in task 03).

4. **Configure the app** (`app.config.ts`):
   - `expo-dev-client` plugin.
   - iOS deployment target high enough for liquid glass (iOS 26); bundle identifier.
   - Register imported/exported **document types** for `.ssrf` and `.xml`
     (`CFBundleDocumentTypes` / `UTImportedTypeDeclarations`) — consumed in task 11.
   - Placeholder config plugin slot for the native module (added in task 02).

5. **Liquid-glass spike (throwaway):**
   - Build one screen using `@expo/ui` native controls (buttons, list, a navigation bar)
     over a glass surface (iOS 26 SwiftUI `.glassEffect` / `@expo/ui` glass container).
   - `npx expo prebuild` then `npx expo run:ios` onto the device.

## Acceptance criteria

- `npx expo run:ios` installs and launches the app on a **physical device**.
- The spike screen shows **native** @expo/ui controls with the **liquid-glass** effect.
- `git submodule status` shows `subsurface/` at the pinned commit.
- The repo builds cleanly from a fresh clone (`git clone --recurse-submodules` → run:ios).

## Notes

- Keep the spike screen isolated (e.g. `app/_spike.tsx`); delete or gate it before task 07.
- If liquid glass is unavailable on the test device's OS version, note it in PROGRESS and
  fall back to a standard translucent material for now; revisit in task 12.
</content>
