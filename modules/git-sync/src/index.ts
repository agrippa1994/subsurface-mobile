// AI-generated (Claude)
// Public TypeScript API of the git-sync native module: typed wrappers over the
// git primitives in ios/GitSyncBridge.m. Which of them to call, and in what
// order, is src/lib/git-sync.ts.
import GitSyncModule, { type NativeEnvelope, type NativeRemote } from './GitSyncModule';

export type GitSyncErrorCode =
  'failed' | 'unknown-host-key' | 'host-key-mismatch' | 'auth-failed' | 'push-rejected';

export class GitSyncError extends Error {
  readonly code: GitSyncErrorCode;
  /** Set for the two host key codes: which server, and what key it presented. */
  readonly host?: string;
  readonly fingerprint?: string;

  constructor(code: GitSyncErrorCode, message: string, host?: string, fingerprint?: string) {
    super(message);
    this.name = 'GitSyncError';
    this.code = code;
    this.host = host;
    this.fingerprint = fingerprint;
  }
}

/** Everything a network operation needs. */
export type Remote = {
  /** `git@host:owner/repo.git` or `ssh://user@host[:port]/path`. */
  url: string;
  /** The private key, as the text of an OpenSSH or PEM key file. */
  privateKey: string;
  passphrase?: string;
  /** SHA256 fingerprint of the host key the user trusted, if any yet. */
  trustedHostKey?: string;
};

async function unwrap<T>(reply: Promise<NativeEnvelope>): Promise<T> {
  const envelope = await reply;
  if (!envelope.ok) {
    const { code, message, host, fingerprint } = envelope.error;
    throw new GitSyncError(code as GitSyncErrorCode, message, host, fingerprint);
  }
  return envelope.result as T;
}

function nativeRemote(remote: Remote): NativeRemote {
  return {
    url: remote.url,
    privateKey: remote.privateKey,
    ...(remote.passphrase ? { passphrase: remote.passphrase } : {}),
    ...(remote.trustedHostKey ? { trustedHostKey: remote.trustedHostKey } : {}),
  };
}

/** A fresh Ed25519 key: the 32-byte seed and public key, base64. */
export function generateKeyPair(): Promise<{ seed: string; publicKey: string; checkInt: number }> {
  return GitSyncModule.generateKeyPair();
}

/** Throws away the app's repository (history, remote refs). The logbook stays. */
export function resetRepository(): Promise<void> {
  return unwrap(GitSyncModule.resetRepository());
}

export type Heads = { local: string | null; remote: string | null };

/**
 * The branch here and the server's branch as of the last fetch or push. Creates
 * the repository if it does not exist yet.
 */
export function heads(branch: string): Promise<Heads> {
  return unwrap(GitSyncModule.heads(branch));
}

/** Fetches the branch. Resolves to the server's commit, or null without one. */
export async function fetchBranch(branch: string, remote: Remote): Promise<string | null> {
  const head = await unwrap<string | null>(GitSyncModule.fetch(branch, nativeRemote(remote)));
  return head ?? null;
}

/** Pushes the branch, fast-forward only. */
export function pushBranch(branch: string, remote: Remote): Promise<void> {
  return unwrap(GitSyncModule.push(branch, nativeRemote(remote)));
}

export type CommitFileArgs = {
  /** The file to commit, a plain path. */
  file: string;
  pathInRepo: string;
  branch: string;
  /** Zero (a first commit), one, or two (a merge) commit ids. */
  parents: string[];
  message: string;
  authorName: string;
  authorEmail: string;
  /** With one parent: commit nothing if the file is what the parent has. */
  skipIfUnchanged?: boolean;
};

/** Commits the file and moves the branch to the new commit. */
export function commitFile(args: CommitFileArgs): Promise<{ commit: string; created: boolean }> {
  return unwrap(GitSyncModule.commitFile({ skipIfUnchanged: false, ...args }));
}

export function setBranch(branch: string, commit: string): Promise<void> {
  return unwrap(GitSyncModule.setBranch(branch, commit));
}

/** Writes a file as of a commit to `destination`. False if it is not in there. */
export function extractFile(
  commit: string,
  pathInRepo: string,
  destination: string,
): Promise<boolean> {
  return unwrap(GitSyncModule.extractFile(commit, pathInRepo, destination));
}

export function aheadBehind(
  local: string,
  upstream: string,
): Promise<{ ahead: number; behind: number }> {
  return unwrap(GitSyncModule.aheadBehind(local, upstream));
}

export type CommitInfo = { id: string; message: string; time: number };

export function describeCommit(commit: string): Promise<CommitInfo> {
  return unwrap(GitSyncModule.describeCommit(commit));
}
