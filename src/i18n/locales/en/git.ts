// AI-generated (Claude)
export default {
  result: {
    upToDate: 'The logbook is up to date.',
    sentPushed: 'Your changes were committed and pushed.',
    sent: 'Your changes were committed. They reach the server with the next push.',
    received: 'The logbook was updated with the changes from the server.',
    merged: 'The changes from the server were merged with yours.',
    mergedPushed: 'The changes from the server were merged with yours and pushed.',
  },
  error: {
    authTitle: 'The server refused the key',
    authMessage: 'Add the public key to the repository host (as a deploy key with write access, or to your account), or check the passphrase of an imported key.',
    pushTitle: 'The server refused the push',
    pushMessage: 'The repository changed while syncing, or the branch is protected. Sync again to bring in its changes first.',
    keyTitle: 'The SSH key could not be used',
    keyMessage: 'The passphrase is wrong, or the key file is damaged. Import the key again.',
    failed: 'Sync failed',
  },
  head: {
    none: 'No commits yet',
  },
  server: {
    neverPushed: 'Not pushed yet',
    ahead_one: '{{count}} to push',
    ahead_other: '{{count}} to push',
    behind_one: '{{count}} to pull',
    behind_other: '{{count}} to pull',
    inSync: 'In sync',
  },
  remote: {
    empty: 'Enter the repository URL.',
    https: 'Only SSH URLs are supported for now, such as git@github.com:you/logbook.git.',
    invalid: 'This is not an SSH repository URL, such as git@github.com:you/logbook.git.',
  },
  config: {
    branch: 'Not a valid branch name.',
    path: 'A relative file path, such as logbook.ssrf.',
    authorName: 'Commits need an author name.',
    authorEmail: 'Commits need an email address.',
  },
  key: {
    truncated: 'The key file is truncated.',
    public: 'This is a public key. Pick the private key file (the one without .pub).',
    incomplete: 'The key file is incomplete.',
    notOpenssh: 'This is not an OpenSSH private key.',
    empty: 'The key file holds no key.',
    notPrivate: 'This is not an SSH private key.',
  },
};
