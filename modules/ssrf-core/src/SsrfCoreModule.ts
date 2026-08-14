// AI-generated (Claude)
import { NativeModule, requireNativeModule } from 'expo';

import type { SsrfCoreNativeModule } from './SsrfCore.types';

declare class SsrfCoreModule extends NativeModule<{}> implements SsrfCoreNativeModule {
  call(method: string, argsJson: string): string;
  add(a: number, b: number): number;
  smokeSerializeMinimalLog(): string | null;
  smokeCountDivesInFile(path: string): number;
}

export default requireNativeModule<SsrfCoreModule>('SsrfCore');
