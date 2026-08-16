// AI-generated (Claude)
// Tests for the problem log's pure half.

import { describe, expect, it } from 'vitest';

import { SsrfCoreError } from './index';
import { appendLine, diagnosticsSummary, formatEntry, toEntry } from './diagnostics';

const AT = new Date('2026-08-16T09:30:00Z');

describe('toEntry', () => {
  it('keeps what the core reported alongside the summary', () => {
    const error = new SsrfCoreError('failed to parse logbook.ssrf', [
      'unknown tag in line 12',
      'no dives found',
    ]);
    expect(toEntry('import', error, AT)).toEqual({
      at: '2026-08-16T09:30:00.000Z',
      context: 'import',
      message: 'failed to parse logbook.ssrf',
      details: ['unknown tag in line 12', 'no dives found'],
    });
  });

  it('drops container paths, which differ on every install and say nothing', () => {
    const error = new Error('could not read /var/mobile/Containers/Data/ABC-123/Documents/x.ssrf');
    expect(toEntry('load', error, AT).message).toBe('could not read x.ssrf');
  });

  it('records something for a thrown value that is not an Error', () => {
    expect(toEntry('render', 'boom', AT).message).toBe('boom');
  });
});

describe('formatEntry', () => {
  it('puts one failure on one line', () => {
    const line = formatEntry(toEntry('import', new Error('bad file\nsecond line'), AT));
    expect(line).toBe('2026-08-16T09:30:00.000Z [import] bad file second line');
    expect(line.split('\n')).toHaveLength(1);
  });
});

describe('appendLine', () => {
  it('keeps only the newest entries', () => {
    let log = '';
    for (let i = 0; i < 10; i += 1) {
      log = appendLine(log, `line ${i}`, 3);
    }
    expect(log).toBe('line 7\nline 8\nline 9\n');
  });

  it('survives a log that was truncated or left blank', () => {
    expect(appendLine('', 'first')).toBe('first\n');
    expect(appendLine('\n\n', 'first')).toBe('first\n');
  });
});

describe('diagnosticsSummary', () => {
  it('says when there is nothing to report', () => {
    expect(diagnosticsSummary('')).toBe('No problems recorded');
  });

  it('counts the entries and dates the last one', () => {
    const log = appendLine(appendLine('', formatEntry(toEntry('a', new Error('x'), AT))),
      formatEntry(toEntry('b', new Error('y'), AT)));
    expect(diagnosticsSummary(log)).toBe('2 entries, last on 2026-08-16');
  });
});
