// AI-generated (Claude)
// System URLs before the router sees them.
//
// A file opened from Files, Mail or AirDrop arrives as a `file://` URL through
// the same channel as a deep link. It is not a route: left alone, the router
// matches it against nothing, lands on "page could not be found", and resets
// its tree to get there - remounting every screen in the middle of the import
// the file triggered. The file itself is handled by
// src/features/transfer/use-incoming-files.ts, which listens for the URL on its
// own, so the router is told to ignore it.

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (path.startsWith('file://')) {
    // A launch has to land somewhere; the index redirects to the dive list.
    return initial ? '/' : null;
  }
  return path;
}
