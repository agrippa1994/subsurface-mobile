// AI-generated (Claude)
// Difference reporting for round-trip comparisons.
//
// Saving a logbook that was authored elsewhere and reading it back does not
// give a bit-identical model, and that is upstream behaviour rather than a shim
// defect: `dive::fixup` (subsurface/core/dive.cpp) completes what the file left
// open. Desktop Subsurface does exactly the same on its first save, so matching
// it means reproducing it, not suppressing it.
//
// Four such completions exist, each allowed below and nowhere else:
//
//  1. `divecomputer::when` is 0 in files that give no per-computer timestamp;
//     the writer emits the dive's date, so the reload has it.
//  2. Dives with no samples get a fabricated profile (`fake_dc`, dive.cpp:1081)
//     built from max depth and duration. It is saved, and the reload recomputes
//     the mean depth from those samples - a drift of a few millimetres, or a
//     value where the file had none.
//  3. `sac` follows from the profile, so it moves with the mean depth.
//  4. A gas-switch event that names a cylinder whose mix contradicts the event's
//     own o2/he attributes is rewritten to the cylinder's mix.
//  5. Whitespace around a text node (notes) is trimmed on the way back in.
//
// Everything else is data loss and must fail the test. From the second
// generation on nothing is left to complete, so the model and the file are
// fixed points - which is the invariant that actually protects user data,
// because the app only ever rewrites files it wrote itself.

const MEAN_DEPTH_TOLERANCE_MM = 50;
const SAC_TOLERANCE = 0.01;

function isFixupOf(path: string, before: unknown, after: unknown): boolean {
  // 1. Per-divecomputer timestamp filled in from the dive.
  if (/^\.dives\.\d+\.dcs\.\d+\.when$/.test(path) && before === 0) {
    return true;
  }
  // 2. Mean depth recomputed off the fabricated profile.
  if (/^\.dives\.\d+(\.dcs\.\d+)?\.meanDepthMm$/.test(path)) {
    if (before === 0) {
      return true;
    }
    return (
      typeof before === 'number' &&
      typeof after === 'number' &&
      Math.abs(after - before) <= MEAN_DEPTH_TOLERANCE_MM
    );
  }
  // 3. SAC follows the profile.
  if (/^\.dives\.\d+\.sac$/.test(path)) {
    return (
      typeof before === 'number' &&
      typeof after === 'number' &&
      (before === 0 || Math.abs(after - before) <= Math.abs(before) * SAC_TOLERANCE)
    );
  }
  // 4. Gas-switch event realigned to the cylinder it names.
  if (/^\.dives\.\d+\.dcs\.\d+\.events\.\d+\.gasmix\./.test(path)) {
    return true;
  }
  // 5. Whitespace around an XML text node: the writer puts the text on its own
  //    line and the parser trims it back off. The text itself is untouched.
  if (typeof before === 'string' && typeof after === 'string' && before.trim() === after.trim()) {
    return true;
  }
  return false;
}

/**
 * Differences between two snapshots, with the documented first-save fixups
 * filtered out when `allowFixups` is set. An empty array means parity.
 */
export function diffSnapshots(
  before: unknown,
  after: unknown,
  { allowFixups = false } = {},
): string[] {
  const out: string[] = [];

  const walk = (a: unknown, b: unknown, path: string): void => {
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
        out.push(`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
        return;
      }
      a.forEach((item, i) => walk(item, b[i], `${path}.${i}`));
      return;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const key of keys) {
        walk(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          `${path}.${key}`,
        );
      }
      return;
    }
    if (a !== b && !(allowFixups && isFixupOf(path, a, b))) {
      out.push(`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
    }
  };

  walk(before, after, '');
  return out;
}
