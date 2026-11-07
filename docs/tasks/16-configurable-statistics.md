# 16 - Configurable statistics

Closes a parity gap with the legacy Qt mobile app: `qml/StatisticsPage.qml` and
`statsmanager.cpp` in `subsurface/mobile-widgets`, over `subsurface/stats/`.

The overview (tiles and default charts) stays the landing screen. Configuration is one
step further in, as questions to start from and a builder.

## What is where

| Piece | Role |
| --- | --- |
| `stats/statsvariables.cpp`, `stats/statsstate.cpp` | The 29 variables, binners, operations, and which combinations are valid. Compiled byte-identical to upstream. |
| `cpp/shim/include/ssrf-qstring.h` | The `QString`, `QLocale` and `QObject` stand-in they compile against. |
| `cpp/shim/stats-helpers.cpp` | Units, trip titles and day names they read from upstream files not compiled here. |
| `cpp/bindings/stats-chart.cpp` | `statsChart`: rebuilds a `StatsState` from a configuration, applies one change, and the data half of `StatsView::plot*`, with the slice selection of `PieSeries`. |
| `src/models/stats-chart.ts` | Words: presets, plain descriptions, rows, readouts, VoiceOver summaries. |
| `src/models/stats-chart-layout.ts` | Geometry and hit testing, pure. |
| `src/features/statistics/` | Shared filter (`statistics-context.tsx`), the filter bar, and screen hooks. |
| `src/components/stats-chart.tsx`, `stats-row.tsx` | Skia canvas; rows for horizontal charts and the values under the others. |
| `src/app/(tabs)/statistics/` | `explore`, `chart`, `builder` (formSheet over the chart), `dives`, and the dive stack re-exported. |

## Decisions

- **How far `stats/` can be reused.** `statsvariables.cpp` and `statsstate.cpp` use Qt only
  for strings, locale number formatting and translation markers: they compile unchanged, no
  patch. Everything else in `stats/` draws through Qt Quick. `statsview.cpp` mixes the data
  and the drawing in one function per chart type, so that data half is ported to the
  bindings, in C++, with the upstream function named above each port.
- **The configuration is stateless JSON.** The app persists it in `settings.json`; each call
  replays it through `var1Changed()` and friends, so `validate()` is what constrains choices.
  Variables and enums go by name, binners by index.
- **Filters.** One filter, the overview's, shared by every chart and shown on the chart
  screen too. There is no second set.
- **Planned dives count by default**, as on desktop: the numbers must match it. The log's
  planned dives are visible as a chip that leaves them out, offered only when there are any,
  which applies to the overview and charts alike.

## Deliberately left out or changed

| What | Why |
| --- | --- |
| Lasso selection and "restrict to selection" of the desktop | Desktop only; legacy mobile has neither. Tapping through to dives covers the phone's need. |
| A selection shared with the dive list | The app's dive list has its own selection mode. A chart item opens a list of its dives instead. |
| Horizontal charts as a canvas with axes | Drawn as a virtualized list of rows with bars: a chart of hundreds of sites scrolls, and each row is a button VoiceOver reads. Values are on the row, so no value axis. |
| More than eight series | Folded into "Other", largest kept, no dive lost. The palette has eight slots; legacy generates hues. |
| Group separators and localized numbers in labels | The stand-in formats in the C locale, as the rest of the shim does. Labels only. |
| Translations | `tr()` is identity, as everywhere in this app so far. |
| Case-insensitive sorting outside ASCII, Latin, Greek, Cyrillic | Only affects the order of two names differing by case in another script. |
| Regression line and band over the whole axis | Drawn over the data range. The numbers are upstream's; only how far they extend differs. |

## Acceptance criteria

- `tests/stats-chart.test.ts`: numbers worked out from each dive's own values with upstream's
  formulas written out, every combination valid, the configuration replaying to itself, also
  under AddressSanitizer, across `subsurface/dives/`, and on `subsurface.xml`.
- `tests/stats-chart-presets.test.ts`: every preset stays what it says, and has data.
- Model tests for words, folding, label collisions and hit testing.
- On a simulator of its own: overview, explore, chart of each family, builder, tap-through,
  landscape, light and dark. See `PROGRESS.md` for what was and was not checked.
