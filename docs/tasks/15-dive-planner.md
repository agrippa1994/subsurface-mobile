# 15 - Dive planner and gas calculator

Closes a parity gap with the legacy Qt mobile app: `qml/DivePlannerSetup.qml`,
`qml/DivePlannerEdit.qml` and `qml/DivePlannerGasCalculator.qml` in
`subsurface/mobile-widgets`.

This output can influence real dives. Nothing in the app computes decompression or
gas consumption: every figure is the core's.

## What is where

| Piece | Role |
| --- | --- |
| `core/planner.cpp`, `plannernotes.cpp`, `deco.cpp` | `plan()` and its notes. Untouched apart from patch 0009. |
| `cpp/bindings/planner.cpp` | `planDive`, `savePlan`, `gasInfo`, `plannerOptions`, `plannerSurface`: what `qt-models/diveplannermodel.cpp` does around the core, which is Qt and cannot be vendored. |
| `src/models/planner.ts` | The plan being edited, and what a screen leads with: stops read off the waypoints, gas rows, warnings. |
| `src/models/plan-notes.ts` | The core's HTML notes as native blocks, and the warnings out of them. |
| `src/models/planner-settings.ts` | The setup page as a table both settings screens draw, persisted in `settings.json`. |
| `src/models/gas-calculator.ts` | The gas calculator's presentation. |
| `src/features/tools/use-planner*.ts` | The screens' state. The plan is worked out during render. |
| `src/app/(tabs)/tools/planner*`, `gas*` | SwiftUI forms on iOS, the portable pattern elsewhere. |

## Decisions

- **The plan is computed synchronously in render.** The result on screen is a function
  of the inputs on screen, so a stale one cannot be drawn, including when a dive in the
  logbook changes, because the dive list is a dependency too. It is the same reasoning
  as the nitrox tool. On the `-O0` host binary a default plan answers in 30 ms and a
  100 m, 60 min VPM-B trimix plan in 200 ms, with the screen's limits of 150 m and 240
  min per level keeping the rest out of reach by stepper.
- **Save plans again.** `savePlan` takes the same arguments as `planDive` and runs
  `plan()` afresh with the disclaimer in the notes. It refuses anything but `ok`.
- **A plan with no ascent shows no figures.** On `timeout`, `inappropriateGas` and
  `noSuitableBailoutGas` the screen shows only the core's reason.
- **Warnings beyond the notes.** Three facts the core reports other than with
  `Warning:` are raised as warnings too: a waypoint above the ceiling, a cylinder below
  minimum gas, and an overlap with a dive in the log.
- **`prefs` is restored after every call.** `plan()` reads nearly everything from
  `prefs`, and this build leaves those at zero for the rest of the module.
- **Patch 0009.** `wait_until()` limited a stop on the dive's clock, which recursed
  without end once a plan ran past 48 hours: a real stack overflow on a 300 m plan.

## Different from the legacy app, on purpose

| What | Legacy | Here | Why |
| --- | --- | --- | --- |
| Result | A button-free preview under the inputs | Warnings, runtime and gas first | What the diver needs first |
| Calculate | Button in the gas calculator | Live | Nothing can be left out of date |
| Drop to first depth | Follows the core's default, off | On by default | Off, a one-level plan descends for its whole time |
| Isobaric counterdiffusion check | Off, no switch on the page | On, with a switch | Its warning is behind it |
| END and EAD | `(atm - 1) * 10 m`, 0.79 | `calculate_gas_information_new()`'s formula | Agrees with the profile, at altitude and in fresh water |
| Autogroup on save | The log's setting | Never | This app's rule: `disable_autogroup` in `api.cpp` |
| First segment on another cylinder | One second on cylinder 0, then a switch | Moved to the front, as desktop does | A switch that never happens is a wrong plan |

## Left out, on purpose

- **Replanning a logged dive and editing an old plan** (desktop's `loadFromDive`). The
  legacy mobile planner only makes new plans. A saved plan can be deleted like any dive.
- **Editing a gas's switch depth.** Desktop only. The auto depth is shown as "Switch at".
- **The cylinder types of the log in the type list.** `manager.cylinderListInit` is a Qt
  list; here it is the core's table. A free-form size is not offered by legacy either.
- **"Allow OC gas as diluent".** A desktop preference; the legacy planner has no switch.
- **Translation of the notes.** `translate()` in the shim returns the English text, as
  for everything in this app.

## Acceptance

- [x] `tests/planner.test.ts`: `testplan.cpp`'s plans through the bindings, with its
      minimum gas, gas change depths and known runtimes, exact.
- [x] A saved plan is `planned` after a round trip through the file, and its tissues
      count for the next plan.
- [x] Model tests over the core's real answers (`tests/planner-model.test.ts`) and
      `src/models/*.test.ts`.
- [x] vitest, lint and typecheck.

See `PROGRESS.md` for what was run on a device.
