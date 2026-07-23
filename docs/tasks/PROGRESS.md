# Progress

Update this checklist as tasks complete. A task is "done" only when its **Acceptance
criteria** pass. If blocked, leave it unchecked and add a note.

- [x] 00 — Overview & conventions read
- [~] 01 — Repo + Expo dev-client skeleton (code done; on-device build pending)
- [ ] 02 — Native module scaffold (trivial JSI fn)
- [ ] 03 — Vendor core subset + de-Qt shim compiles
- [ ] 04 — iOS native deps (libxml2/libxslt/libzip) link
- [ ] 05 — JSI bridge + API implemented
- [ ] 06 — TS models + vitest golden tests green
- [ ] 07 — Navigation + dive list (read-only)
- [ ] 08 — Dive detail + profile diagram (Skia)
- [ ] 09 — Statistics screen
- [ ] 10 — Editing: dives, dive sites, buddies
- [ ] 11 — Suunto import + SSRF import/export
- [ ] 12 — Polish + TestFlight beta
- [ ] 13 — Android parity (later phase)

## Notes / blockers

- 2026-07-23 — Task 01: repo initialized (git, GPL-2.0 LICENSE, README, .gitignore).
  Expo SDK 57 app scaffolded (Expo Router, TS strict, src/ layout). Deps added:
  expo-dev-client, @expo/ui, @shopify/react-native-skia, expo-document-picker,
  expo-sharing, expo-file-system (all aligned to SDK 57 via `expo install --fix`).
  `subsurface/` added as a git submodule pinned at e412ccb85, URL = github origin.
  Dynamic `app.config.ts` created (replaces app.json): expo-dev-client plugin,
  iOS bundle id `org.subsurface.mobile`, deploymentTarget 26.0, `.ssrf`/`.xml`
  document types, native-module plugin slot for task 02. Liquid-glass spike at
  `src/app/_spike.tsx` (GlassView + @expo/ui Host/Button/List). `expo config`
  resolves clean.
  BLOCKED on-device acceptance: `npx expo prebuild` + `npx expo run:ios` onto a
  physical iOS 26 device (liquid glass + native module do not run in simulator /
  Expo Go) must be run on a Mac with Xcode + a device. Not executable here.
</content>
