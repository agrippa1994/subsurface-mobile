// AI-generated (Claude)
// Builds the host driver once before the suite runs, so the golden tests always
// exercise the current C++ bindings rather than a stale binary.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { DIVES_DIR, MODULE_ROOT } from './harness/fixtures';

export default function setup(): void {
  if (!existsSync(DIVES_DIR)) {
    throw new Error(
      `Fixtures missing at ${DIVES_DIR}. Run: git submodule update --init --recursive`,
    );
  }
  execFileSync(join(MODULE_ROOT, 'scripts/build-host.sh'), ['--build'], {
    cwd: MODULE_ROOT,
    stdio: 'inherit',
  });
}
