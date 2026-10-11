// AI-generated (Claude)
// SSH remote URLs, in the two spellings git accepts:
//
//   git@github.com:owner/logbook.git          (scp-like)
//   ssh://git@example.org:2222/srv/logbook.git
//
// The sync only needs to know which server a URL points at, because that is
// what a trusted host key belongs to. libgit2 does the real parsing.

export type RemoteUrl = {
  user: string | null;
  host: string;
  /** null for the default, 22. */
  port: number | null;
  path: string;
};

export function parseRemoteUrl(input: string): RemoteUrl | null {
  const url = input.trim();

  const ssh = /^ssh:\/\/(?:([^@/]+)@)?(\[[^\]]+\]|[^:/]+)(?::(\d+))?(\/.*)$/.exec(url);
  if (ssh) {
    const port = ssh[3] === undefined ? null : Number(ssh[3]);
    if (port !== null && (port < 1 || port > 65535)) {
      return null;
    }
    return {
      user: ssh[1] ?? null,
      host: ssh[2].replace(/^\[|\]$/g, ''),
      port: port === 22 ? null : port,
      path: ssh[4],
    };
  }

  // scp-like: no scheme, a colon before the first slash.
  const scp = /^(?:([^@/:]+)@)?([^@/:]+):(?!\/\/)(.+)$/.exec(url);
  if (scp) {
    return { user: scp[1] ?? null, host: scp[2], port: null, path: scp[3] };
  }

  return null;
}

/** Why a URL cannot be used, or null if it can. */
export function validateRemoteUrl(input: string): string | null {
  const url = input.trim();
  if (url === '') {
    return 'Enter the repository URL.';
  }
  if (/^https?:\/\//i.test(url)) {
    return 'Only SSH URLs are supported for now, such as git@github.com:you/logbook.git.';
  }
  if (parseRemoteUrl(url) === null) {
    return 'This is not an SSH repository URL, such as git@github.com:you/logbook.git.';
  }
  return null;
}

/**
 * What a trusted host key is filed under: the host, plus the port when it is
 * not 22 - the same distinction OpenSSH's known_hosts makes.
 */
export function hostKeyId(url: RemoteUrl): string {
  return url.port === null ? url.host : `[${url.host}]:${url.port}`;
}
