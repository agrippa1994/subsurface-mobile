# Desktop interop check

Definition of done, item 3: a logbook exported by the app opens unchanged in
desktop Subsurface. This is the one check the automated suite structurally
cannot do - it compares the app against itself, using the same vendored core.
Only the real desktop binary can tell us whether that core, as we build it,
still writes what desktop reads.

Manual by necessity. The desktop GUI takes a file argument
(`subsurface-desktop-main.cpp:53-69`) but has no headless load-and-save mode, so
there is nothing to automate against the binary a user actually runs.

## Setup

| Fact | Value |
| --- | --- |
| Desktop | `/Applications/Subsurface.app`, version from its `Info.plist` (was `6.0.5592-CICD-release` when this was written) |
| App core | pin `e412ccb85`, core version `6.0.5658` (`modules/ssrf-core/cpp/CORE_MANIFEST.md`) |
| Data format | `dataformat_version` is a compile-time `3` on both sides (`subsurface/core/version.h`) |

Note the skew direction: the app is built on a core *newer* than the installed
desktop, not older. Record both versions in the result - the meaning of any
mismatch depends on them.

## Artifacts

Three files, each exported from the phone via Settings > Transfer > "Export and
share" (see `device-acceptance.md` section G) and AirDropped to the Mac:

- **A1** - the untouched bundled sample. Round trip of a desktop-authored file
  (18 dives, 26 sites).
- **A2** - after importing the Suunto DM4 sample. Data the app itself produced,
  including a profile decoded from Suunto blobs.
- **A3** - after the edits in section F: a buddy, notes, tags, a rating, and a
  move to a newly created site with GPS.

Keep an unmodified copy of `assets/sample/sample-log.ssrf` next to them as the
baseline A1 is a round trip of.

## Procedure, per artifact

1. `open -a Subsurface <artifact>.ssrf`
2. No error dialog, no "unknown format", no missing-data warning in the
   notification area.
3. Compare against the phone, field by field:
   - dive count, and the trips the dives are grouped into
   - per dive: date, time, duration, max depth, mean depth
   - cylinders: type, size, working pressure, start and end pressure, gas mix
   - water and air temperature
   - sample count and the shape of the profile (A2 especially - that profile
     came out of `cpp/bindings/suunto-xml.cpp`, not out of an XML file)
   - events, including gas switches
   - buddy, divemaster, rating, visibility, suit, tags, notes (A3)
   - dive site name and GPS position (A3)
   - SAC, OTU, CNS
4. The stronger check, worth doing at least for A1: in desktop, **Save As** to a
   copy, then `diff` that copy against the app's file. Also run both files
   through the app's own core - `modules/ssrf-core/scripts/build-host.sh <file>`
   - so the comparison is of parsed models, not of text layout.

## What is allowed to differ

Exactly the five first-save `dive::fixup` completions enumerated in
`tests/harness/parity.ts`, which desktop performs on its own first save of a
foreign file just as the app does:

1. `divecomputer::when` filled in from the dive's date when the file gave no
   per-computer timestamp.
2. A dive with no samples gets a fabricated profile, and mean depth is
   recomputed off it (tolerance 50 mm).
3. `sac` follows that recomputed profile (tolerance 1%).
4. A gas-switch event naming a cylinder whose mix contradicts the event's own
   o2/he attributes is rewritten to the cylinder's mix.
5. Whitespace around a text node is trimmed.

Plus desktop's own `<settings>` / preferences block, which the app never writes.

Anything else is a finding. Record the exact element and attribute.

## Reading a mismatch

The writer is not where to look first: `core/save-xml.cpp` is vendored
**unpatched**, contains no `prefs.` references, and the file carries no app
provenance. In order of suspicion:

1. **Shim overrides on the save path** -
   `modules/ssrf-core/cpp/shim/override/filterconstraint.cpp` is a
   reimplementation and `save-xml.cpp` includes `filterconstraint.h`. Also
   `format.cpp`, `qthelper.cpp`, `gettext.cpp`.
2. **Patch `0006-xslt-match-namespace-declaration`**, the only patch on the
   read path (`core/parse-xml.cpp`) - relevant if the app *read* something
   wrongly rather than wrote it.
3. **Version skew** between the pin and the installed desktop. Check the
   upstream history of the element in question before assuming a shim bug.

Identify the source before changing anything. A C++ change must be followed by
`npm test` and `SSRF_ASAN=1 npm test`.

## Known gap

No file in `subsurface/dives/`, and not the bundled sample, contains a
`<filterpreset>`, so `filterconstraint.cpp` - the one non-trivial
reimplementation on the save path - never emits in any of the checks above.

To cover it: create a filter preset in desktop Subsurface, save that logbook,
import it into the app, export, and reopen in desktop. If this is skipped, say
so in the result rather than letting a pass imply the path was exercised.

## Result

| Artifact | Date | Desktop version | App core | Opened | Differences | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| A1 sample round trip | | | | | | |
| A2 Suunto import | | | | | | |
| A3 after edits | | | | | | |
| Filter preset (optional) | | | | | | |
