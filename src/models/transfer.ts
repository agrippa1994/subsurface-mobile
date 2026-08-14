// AI-generated (Claude)
// Import and export decisions that are not about rendering: which files the
// picker offers, what an import is called, and how a result reads.
//
// The module detects a file's format from its contents, not its name (see
// modules/ssrf-core/src/index.ts), so nothing here maps an extension to a
// parser. Names matter for two other things only: what the document picker
// lets the user choose, and whether a file is a whole logbook - which is the
// difference between "open this instead" and "merge this in".

import type { ImportResult } from '@/models';

/**
 * What the document picker accepts. iOS matches on UTIs; `public.data` is the
 * catch-all for the Suunto formats, which have no registered type of their own
 * (.sde, .db) and would otherwise be greyed out in Files.
 */
export const IMPORT_DOCUMENT_TYPES = [
  'org.subsurface.ssrf',
  'public.xml',
  'public.json',
  'public.zip-archive',
  'public.data',
];

/** Extensions that hold a whole logbook, which the app can open in place of its own. */
const LOGBOOK_EXTENSIONS = ['ssrf', 'xml'];

export function fileExtension(name: string): string {
  const at = name.lastIndexOf('.');
  return at < 0 ? '' : name.slice(at + 1).toLowerCase();
}

/**
 * True for a file that could be a logbook rather than a single-dive export.
 * A `.xml` may be either (a Suunto DM4 export is one dive), so this only says
 * that replacing is worth offering - it is not a claim about the contents.
 */
export function isLogbookName(name: string): boolean {
  return LOGBOOK_EXTENSIONS.includes(fileExtension(name));
}

/** `subsurface-2026-08-14.ssrf`: sorts by date and says what wrote it. */
export function exportFileName(when: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `subsurface-${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}.ssrf`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * The import summary the app shows. Merged dives are worth naming explicitly:
 * importing the same file twice is a no-op by design, and without a word for it
 * that looks like the import silently failed.
 */
export function describeImport(result: ImportResult): string {
  const parts: string[] = [];
  if (result.added > 0) {
    parts.push(`${plural(result.added, 'dive')} added`);
  }
  if (result.merged > 0) {
    parts.push(`${plural(result.merged, 'dive')} already in the logbook`);
  }
  if (result.failed > 0) {
    parts.push(`${plural(result.failed, 'file')} could not be read`);
  }
  if (parts.length === 0) {
    return 'Nothing to import.';
  }
  return `${parts.join(', ')}. The logbook now holds ${plural(result.dives, 'dive')}.`;
}
