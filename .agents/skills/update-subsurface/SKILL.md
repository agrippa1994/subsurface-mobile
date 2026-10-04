---
name: update-subsurface
description: Bump the read-only `subsurface/` git submodule (the upstream Subsurface C++ core) to the latest upstream commit, fix whatever the vendored core build breaks via patches/shim only, verify host + ASAN + iOS builds, update the recorded pins, and report what changed upstream. Use when asked to update, bump, refresh or fetch the latest Subsurface / core / submodule.
---

<!-- AI-generated (Claude) -->

# Update the Subsurface core submodule

`subsurface/` is consumed read-only. **Never edit anything under it.** Every
build break caused by a new upstream commit is fixed in
`modules/ssrf-core/patches/*.patch`, `modules/ssrf-core/cpp/shim/` or
`modules/ssrf-core/core-subset.mjs` - nowhere else.

Background reading: `modules/ssrf-core/cpp/CORE_MANIFEST.md` (pins, compiled
sources, patches, shim overrides) and `modules/ssrf-core/scripts/vendor-core.mjs`
(copy -> patch -> overlay into `cpp/generated/`).

## 1. Fetch and move the pin

```sh
OLD=$(git -C subsurface rev-parse HEAD)
git -C subsurface fetch origin
git -C subsurface checkout origin/master
git -C subsurface submodule update --init --recursive   # libdivecomputer
NEW=$(git -C subsurface rev-parse HEAD)
bash -c 'cd subsurface && scripts/get-version.sh 3'     # core version, e.g. 6.0.5741
```

Do not run `git checkout` inside `subsurface/` while an Xcode build is running:
the build phase re-vendors the core keyed on the submodule's HEAD.

## 2. Scope the upstream change

```sh
git -C subsurface log --oneline --no-merges $OLD..$NEW | wc -l
git -C subsurface diff --stat $OLD $NEW -- core libdivecomputer xslt
```

Only files listed in `core-subset.mjs` (`CORE_SOURCES`, all `core/*.h`,
`xslt/`) plus the libdivecomputer headers reach the build. For each of those
that changed, `git -C subsurface log --format='%h %s' $OLD..$NEW -- <file>`
gives the commits to report. Also check whether any changed header is one the
shim replaces (`cpp/shim/override/`): upstream signature changes there must be
mirrored by hand, the compiler only catches them where a vendored caller uses
the new signature.

## 3. Build and fix

```sh
rm -rf modules/ssrf-core/build/host modules/ssrf-core/build/asan
./modules/ssrf-core/scripts/build-host.sh
```

Always clean first: `build-host.sh` rebuilds only `.cpp` files newer than their
object, so shim/bindings objects are not rebuilt when a core header changes.

Typical failures and fixes:

- **`[vendor-core] patch failed`** - upstream touched a patched region. Diff
  the file `$OLD..$NEW`. If upstream fully fixed the issue, delete the patch,
  remove it from `PATCHES` in `core-subset.mjs` and its row in the manifest. If
  only partly, regenerate the patch against the new file (keep the `a/` `b/`
  prefixes and the explanatory header) and update the manifest row.
- **Signature mismatch against a shim override** (e.g. `git_save_dives` gained
  an argument) - update `cpp/shim/override/<header>` and the matching stub in
  `cpp/shim/<file>.cpp` to upstream's signature, defaults included.
- **Undefined symbol at link** - a vendored source started calling something
  new. Stub it in the shim if it is Qt/cloud/desktop-only; add the source to
  `CORE_SOURCES` only if it is Qt-free and genuinely needed. Record either in
  the manifest.
- **New Qt include in a core header** - patch it out (see patch 0001/0002).

## 4. Verify

All of these must pass:

```sh
npm test                    # vitest: models + golden round-trip tests
SSRF_ASAN=1 npm test        # AddressSanitizer sweep over every fixture
npm run typecheck
```

Then the native iOS build (ios/ is git-ignored and regenerated):

```sh
CI=1 npx expo prebuild --platform ios --no-install
(cd ios && pod install)     # if skia complains: npx install-skia, then retry
cd ios && xcodebuild -workspace Subsurface.xcworkspace -scheme Subsurface \
  -configuration Debug -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath build/dd CODE_SIGNING_ALLOWED=NO build
```

Expect `** BUILD SUCCEEDED **`. Takes several minutes; run it in the
background. Golden tests may change because upstream changed parse/save
behaviour - compare against upstream's own `subsurface/tests/` reference
updates before touching an expectation, and never loosen a test just to pass.

## 5. Record the new pin

Replace the old short SHA and core version everywhere they are echoed:

```sh
grep -rn "<old-sha9>\|<old-version>" --exclude-dir=node_modules --exclude-dir=subsurface \
  --exclude-dir=ios --exclude=subsurface.xml .
```

That is `modules/ssrf-core/cpp/CORE_MANIFEST.md` (Pins table: submodule SHA +
subject, core version, libdivecomputer SHA), `docs/device-acceptance.md`,
`docs/interop-check.md`, `src/models/about.ts`, `src/models/about.test.ts`.
Re-run `npm test` after.

## 6. Commit and report

One commit, in the style of earlier bumps (`git log --oneline -- subsurface`):
subject `Update subsurface submodule to <sha9>`, body listing the upstream
commit count, the notable themes, every patch/shim change and why, and the
verification that was run.

Report to the user:

- old -> new SHA, core version, libdivecomputer SHA, commit count
- upstream changes that reach the mobile build (per vendored file, with
  commit subjects), called out separately from desktop/mobile-Qt/CI noise
- what had to change here (patches, shim, subset) and why
- verification results, including anything skipped or failing and whether it
  predates the bump
