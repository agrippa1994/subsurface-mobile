// AI-generated (Claude)
import { NativeModule, requireNativeModule } from 'expo';

import type { SsrfCoreNativeModule } from './SsrfCore.types';

type SsrfCoreEvents = { onCoreEvent: (event: { json: string }) => void };

declare class SsrfCoreModule extends NativeModule<SsrfCoreEvents> implements SsrfCoreNativeModule {
  call(method: string, argsJson: string): string;
  add(a: number, b: number): number;
  smokeSerializeMinimalLog(): string | null;
  smokeCountDivesInFile(path: string): number;
  /** Android only: copies a content:// file into the cache, returns its path. */
  copyContentUri?(uri: string): Promise<string>;
}

export default requireNativeModule<SsrfCoreModule>('SsrfCore');
