// AI-generated (Claude)
import { registerWebModule, NativeModule } from 'expo';

// Web has no native core. Everything here throws so a misrouted call is loud
// instead of silently wrong. Web is not a target platform for v1.
class SsrfCoreModule extends NativeModule<{}> {
  call(_method: string, _argsJson: string): string {
    throw new Error('ssrf-core is not available on web');
  }

  add(_a: number, _b: number): number {
    throw new Error('ssrf-core is not available on web');
  }

  smokeSerializeMinimalLog(): string | null {
    throw new Error('ssrf-core is not available on web');
  }

  smokeCountDivesInFile(_path: string): number {
    throw new Error('ssrf-core is not available on web');
  }
}

export default registerWebModule(SsrfCoreModule, 'SsrfCoreModule');
