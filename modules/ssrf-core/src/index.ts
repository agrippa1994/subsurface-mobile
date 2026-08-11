// AI-generated (Claude)
// Public TypeScript API of the ssrf-core native module.
import SsrfCoreModule from './SsrfCoreModule';

export * from './SsrfCore.types';

// Smoke test: executes ssrf::add in native C++ (task 02).
export function add(a: number, b: number): number {
  return SsrfCoreModule.add(a, b);
}

// Task 03 smoke units: the first calls that actually run the vendored
// Subsurface core. Removed once the real API lands in task 05.
export function smokeSerializeMinimalLog(): string | null {
  return SsrfCoreModule.smokeSerializeMinimalLog();
}

export function smokeCountDivesInFile(path: string): number {
  return SsrfCoreModule.smokeCountDivesInFile(path);
}

export default SsrfCoreModule;
