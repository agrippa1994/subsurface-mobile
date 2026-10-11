// AI-generated (Claude)
import { NativeModule, requireNativeModule } from 'expo';

/** What every git call answers with; see ios/GitSyncModule.swift. */
export type NativeEnvelope =
  | { ok: true; result: unknown }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        host?: string;
        fingerprint?: string;
        reason?: string;
      };
    };

export type NativeRemote = {
  url: string;
  privateKey: string;
  passphrase?: string;
  trustedHostKey?: string;
};

declare class GitSyncModule extends NativeModule<{}> {
  generateKeyPair(): Promise<{ seed: string; publicKey: string; checkInt: number }>;
  repositoryPath(): Promise<string>;
  resetRepository(): Promise<NativeEnvelope>;
  ensureRepository(): Promise<NativeEnvelope>;
  heads(branch: string): Promise<NativeEnvelope>;
  fetch(branch: string, remote: NativeRemote): Promise<NativeEnvelope>;
  push(branch: string, remote: NativeRemote): Promise<NativeEnvelope>;
  commitFile(args: Record<string, unknown>): Promise<NativeEnvelope>;
  setBranch(branch: string, commit: string): Promise<NativeEnvelope>;
  extractFile(commit: string, pathInRepo: string, destination: string): Promise<NativeEnvelope>;
  aheadBehind(local: string, upstream: string): Promise<NativeEnvelope>;
  describeCommit(commit: string): Promise<NativeEnvelope>;
}

export default requireNativeModule<GitSyncModule>('GitSync');
