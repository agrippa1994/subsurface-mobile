# Releasing to TestFlight

What a build needs, in order. Everything here is task 12, step 6.

## Before the first build

1. **Apple Developer account.** An Apple Developer Program membership (99 USD a
   year), an App Store Connect app record for the bundle id
   `codes.mani.subsurface-react`, and the Team ID.
2. **Fill in `eas.json`.** `submit.production.ios.ascAppId` is the App Store
   Connect app id (a number), `appleTeamId` the Team ID. Both are placeholders
   in the committed file on purpose - they are account facts, not repo facts.
3. **`eas login`** and `eas build:configure` once, which creates the EAS project
   id and stores signing credentials.

## Building

```sh
git submodule update --init --recursive   # the core must be on disk
npx eas build --profile production --platform ios
```

`production` uses `appVersionSource: remote` with `autoIncrement`, so the build
number comes from EAS and rises on every build; the marketing version stays
`version` in `app.config.ts`.

The build runs `expo prebuild`, which runs
`modules/ssrf-core/plugin/withSsrfCore` - the plugin that vendors the core
subset out of `subsurface/` into the module before `pod install`. That means
**the submodule has to be part of what is uploaded**. `scripts/vendor-core.mjs`
falls back to the pin recorded in `cpp/CORE_MANIFEST.md` when the submodule
arrives without its git metadata, but it cannot invent the sources: if the
upload does not carry `subsurface/core/dive.cpp`, the build stops with
"subsurface/ submodule is empty".

## Submitting

```sh
npx eas submit --profile production --platform ios --latest
```

Then, in App Store Connect: add the build to a TestFlight group, fill in
"What to Test", and answer the export-compliance question (the app uses no
encryption beyond HTTPS - it makes no network calls at all).

## Store metadata

`docs/store-listing.md` holds the description, keywords, the privacy answers
and the licence statement to paste into App Store Connect.

## Licence

The app links the GPL-2.0 Subsurface core, so the binary is a derivative work
and is distributed under the GPL-2.0. Two consequences for a public release:

- The About section names the licence, the core version and the pinned commit,
  and links to the source. That link has to keep working for as long as the
  build is distributed.
- Apple's standard EULA is more restrictive than the GPL. App Store Connect
  allows a **custom EULA**; paste the GPL-2.0 text there rather than accepting
  the default. (This is the same route other GPL apps on the App Store take.
  Confirm the stance in `docs/tasks/00-overview-and-conventions.md` before a
  public, as opposed to internal, release.)
