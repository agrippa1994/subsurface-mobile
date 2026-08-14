// AI-generated (Claude)
// AddressSanitizer sweep over the whole fixture corpus.
//
// Opt-in (`SSRF_ASAN=1 npm test`) because it rebuilds the core with
// -fsanitize=address, which takes minutes. Run it after any change to the shim,
// the bindings or the pinned core: memory errors in this codebase surface as
// rare, silent data corruption rather than crashes, so the normal suite catches
// them only by luck. Both bugs found in task 06 - the dangling `current_dive`
// in cpp/shim/selection.cpp and the upstream o2-sensor stack overflow now
// carried as patch 0005 - were found exactly this way.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DIVES_DIR, MODULE_ROOT, fixture, tempDir } from './harness/fixtures';
import { SsrfHost } from './harness/ssrf-host';

const enabled = process.env.SSRF_ASAN === '1';

describe.skipIf(!enabled)('AddressSanitizer', () => {
  it('reports nothing across every logbook, profile and import', async () => {
    execFileSync(join(MODULE_ROOT, 'scripts/build-host.sh'), ['--asan'], {
      cwd: MODULE_ROOT,
      stdio: 'inherit',
    });
    const binary = join(MODULE_ROOT, 'build/asan/ssrf-smoke');
    expect(existsSync(binary)).toBe(true);

    const work = tempDir('ssrf-asan-');
    const host = new SsrfHost(binary);
    try {
      for (const name of readdirSync(DIVES_DIR).filter((f) => /\.(xml|ssrf)$/.test(f))) {
        try {
          await host.loadFromXML(fixture(name));
        } catch {
          continue; // Not a logbook this API accepts.
        }
        // Everything the app does with a loaded log, so the sweep covers the
        // save path and the profile computation, not just the parser.
        await host.saveToXML(join(work, 'sweep.ssrf'));
        await host.loadFromXML(join(work, 'sweep.ssrf'));
        for (const dive of await host.listDives()) {
          await host.getDive(dive.id);
          await host.getProfile(dive.id);
        }
        await host.listDiveSites();
        await host.getStatistics();
      }

      await host.clear();
      await host.importSuunto(fixture('TestDiveDM5.db'));
      await host.importSuunto(fixture('TestDiveDM4.db'));

      expect(host.diagnostics).not.toContain('AddressSanitizer');
    } finally {
      await host.close();
    }
  }, 1800000);
});
