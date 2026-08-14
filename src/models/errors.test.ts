// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import { SsrfCoreError } from './index';
import { describeError, formatErrorLine, shortenPaths } from './errors';

describe('describeError', () => {
  it('keeps the core messages of an SsrfCoreError', () => {
    const info = describeError(new SsrfCoreError('parse failed', ['line 3: no <dive>', 'empty']));
    expect(info.message).toBe('parse failed');
    expect(info.details).toEqual(['line 3: no <dive>', 'empty']);
  });

  it('handles a plain Error and a thrown non-error', () => {
    expect(describeError(new Error('boom'))).toEqual({ message: 'boom', details: [] });
    expect(describeError('nope')).toEqual({ message: 'nope', details: [] });
    expect(describeError(undefined).message).toBe('undefined');
  });
});

describe('formatErrorLine', () => {
  it('returns the message alone when there are no details', () => {
    expect(formatErrorLine({ message: 'parse failed', details: [] })).toBe('parse failed');
  });

  it('appends details and counts the ones it drops', () => {
    const info = { message: 'parse failed', details: ['a', 'b', 'c', 'd'] };
    expect(formatErrorLine(info, 2)).toBe('parse failed: a; b (+2 more)');
  });

  it('shortens sandbox paths and drops a detail that restates the message', () => {
    // Exactly what the bindings report for a malformed logbook.
    const info = {
      message: 'failed to parse /var/mobile/Containers/Data/Application/ABC/Documents/log.ssrf',
      details: ["Failed to parse '/var/mobile/Containers/Data/Application/ABC/Documents/log.ssrf'"],
    };
    expect(formatErrorLine(info)).toBe('failed to parse log.ssrf');
  });

  it('keeps details that say something new', () => {
    const info = { message: 'failed to parse /tmp/log.ssrf', details: ['line 3: no <dive>'] };
    expect(formatErrorLine(info)).toBe('failed to parse log.ssrf: line 3: no <dive>');
  });
});

describe('shortenPaths', () => {
  it('leaves text without paths alone', () => {
    expect(shortenPaths('nothing to shorten')).toBe('nothing to shorten');
  });

  it('reduces every path in the text to its file name', () => {
    expect(shortenPaths('copy /a/b/c.ssrf to /d/e.ssrf')).toBe('copy c.ssrf to e.ssrf');
  });
});
