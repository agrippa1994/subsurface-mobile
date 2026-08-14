// AI-generated (Claude)
// Where the logbook lives on the device, and how the bundled sample gets there.
//
// The SSRF file is the source of truth (see docs/tasks/00-overview-and-
// conventions.md): there is no database, the app keeps one working logbook in
// its documents directory and the native module re-serializes to it on every
// mutation. Documents survives app updates and is what iTunes/Files share when
// that gets switched on.

import { Asset } from 'expo-asset';
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

/**
 * Resolves the bundled sample logbook to a readable local path. In a release
 * build the asset is inside the app bundle; in development Metro serves it and
 * expo-asset caches it to disk first.
 */
export async function sampleLogPath(): Promise<string> {
  // Metro resolves assets through require(); an import would be transformed
  // into a module reference rather than an asset handle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const [asset] = await Asset.loadAsync(require('@/assets/sample/sample-log.ssrf'));
  const uri = asset.localUri ?? asset.uri;
  if (!uri) {
    throw new Error('the bundled sample logbook could not be resolved');
  }
  return toNativePath(uri);
}

/**
 * Makes sure a working logbook exists and returns its path, seeding it from the
 * bundled sample on first run so the app has content before anything is
 * imported. An existing logbook is never overwritten.
 */
export async function ensureLogbook(): Promise<string> {
  const target = logbookFile();
  if (!target.exists) {
    const documents = new Directory(Paths.document);
    if (!documents.exists) {
      documents.create({ intermediates: true });
    }
    const sample = new File(await sampleLogPath());
    sample.copySync(target);
  }
  return toNativePath(target.uri);
}

/** Drops the working logbook, so the next launch seeds the sample again. */
export function resetLogbook(): void {
  const target = logbookFile();
  if (target.exists) {
    target.delete();
  }
}

/**
 * Writes `contents` to a throwaway file in the cache directory and returns its
 * path. Used by the developer tools in Settings to exercise the list's empty
 * and error states against real files.
 */
export function writeScratchFile(name: string, contents: string): string {
  const file = new File(Paths.cache, name);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(contents);
  return toNativePath(file.uri);
}
