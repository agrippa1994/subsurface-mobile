// AI-generated (Claude)
// Where the logbook lives on the device.
//
// The SSRF file is the source of truth (see docs/tasks/00-overview-and-
// conventions.md): there is no database, the app keeps one working logbook in
// its documents directory and the native module re-serializes to it on every
// mutation. Documents survives app updates and is what iTunes/Files share when
// that gets switched on.

import { Directory, File, Paths } from 'expo-file-system';

/** The working logbook. Everything the user imports is merged into this file. */
export const LOGBOOK_FILENAME = 'logbook.ssrf';

export function logbookFile(): File {
  return new File(Paths.document, LOGBOOK_FILENAME);
}

/**
 * The C++ core takes plain filesystem paths, not URIs. expo-file-system hands
 * out `file:///...`, so the scheme is stripped before anything crosses the JSI
 * boundary.
 */
export function toNativePath(uri: string): string {
  return uri.startsWith('file://') ? decodeURI(uri.slice('file://'.length)) : uri;
}

/** What a first launch starts from: a logbook with no dives in it. */
const EMPTY_LOGBOOK = "<divelog program='subsurface' version='3'>\n  <dives/>\n</divelog>\n";

/**
 * Makes sure a working logbook exists and returns its path, creating an empty
 * one on first run. An existing logbook is never overwritten.
 */
export function ensureLogbook(): string {
  const target = logbookFile();
  if (!target.exists) {
    const documents = new Directory(Paths.document);
    if (!documents.exists) {
      documents.create({ intermediates: true });
    }
    target.create();
    target.write(EMPTY_LOGBOOK);
  }
  return toNativePath(target.uri);
}
