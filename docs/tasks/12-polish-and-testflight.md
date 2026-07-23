# 12 — Polish & TestFlight

**Goal:** Ship an iOS beta of v1.

**Prerequisites:** Tasks 07–11 functionally complete.

## Steps

1. **iOS HIG / liquid-glass polish:** consistent navigation, glass surfaces, haptics,
   empty/error states, large-title behavior, dark mode. Revisit any liquid-glass fallback
   noted in task 01.
2. **Accessibility:** Dynamic Type, VoiceOver labels (esp. list rows and charts),
   sufficient contrast, colorblind-safe chart palette (per the `dataviz` skill).
3. **Performance:** test with a **large log** (hundreds+ of dives). Profile list scrolling
   and diagram rendering; virtualize lists; memoize profile geometry.
4. **Robustness:** graceful handling of malformed/partial files; never corrupt the source
   SSRF (atomic writes from task 10); surface module errors as user-friendly messages.
5. **Crash/analytics:** add crash reporting (respecting privacy / GPL).
6. **Release:** app icon, splash, metadata; **EAS build**; upload to **TestFlight**.

## Acceptance criteria

- A **TestFlight** build installs and runs the **full flow** on a real device: import →
  browse → view profile → view statistics → edit → export.
- No corruption of the SSRF file across a stress session of edits/imports.
- Large-log performance is acceptable (smooth scrolling; profile opens quickly).

## Notes

- Confirm the **GPL-2.0** distribution stance (task 00) before any public/TestFlight-wide
  release.
</content>
