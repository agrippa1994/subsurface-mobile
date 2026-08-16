// AI-generated (Claude)
// A synthetic large logbook, for the performance and stress tests (task 12).
//
// The dives are real ones: the blocks are taken verbatim out of
// subsurface/dives/SampleDivesV2.ssrf, which carries full sample profiles,
// cylinders, events and pictures, and are re-dated one per day so the parser
// sees distinct dives rather than duplicates it would merge. Nothing here
// generates dive data of its own - a made-up profile would tell us nothing
// about how the core behaves on the shape of file people actually have.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { fixture, tempDir } from './fixtures';

const SOURCE = 'SampleDivesV2.ssrf';

/** The `<dive ...>...</dive>` blocks of a logbook, trips and all stripped. */
function diveBlocks(xml: string): string[] {
  return xml.match(/<dive [\s\S]*?<\/dive>/g) ?? [];
}

function dateFor(index: number): { date: string; time: string } {
  // One dive a day from 2000-01-01 onwards, two hours apart within the day so
  // the same day never repeats even once the corpus wraps.
  const day = new Date(Date.UTC(2000, 0, 1) + index * 24 * 3600 * 1000);
  const date = day.toISOString().slice(0, 10);
  const hour = 8 + (index % 6);
  return { date, time: `${String(hour).padStart(2, '0')}:15:00` };
}

/**
 * Writes a logbook of `count` dives and returns its path. The caller owns the
 * temporary directory it lands in.
 */
export function writeLargeLog(count: number, dir = tempDir('ssrf-large-')): string {
  const blocks = diveBlocks(readFileSync(fixture(SOURCE), 'utf8'));
  if (blocks.length === 0) {
    throw new Error(`no dives found in ${SOURCE}`);
  }

  const parts: string[] = [`<divelog program='subsurface' version='3'>\n<dives>\n`];
  for (let index = 0; index < count; index += 1) {
    const { date, time } = dateFor(index);
    parts.push(
      blocks[index % blocks.length]
        .replace(/^<dive [^>]*>/, (open) =>
          open
            .replace(/\bnumber='[^']*'/, `number='${index + 1}'`)
            .replace(/\bdate='[^']*'/, `date='${date}'`)
            .replace(/\btime='[^']*'/, `time='${time}'`)
        )
        .concat('\n')
    );
  }
  parts.push('</dives>\n</divelog>\n');

  const path = join(dir, `large-${count}.ssrf`);
  writeFileSync(path, parts.join(''));
  return path;
}

/** Milliseconds spent in `work`, and whatever it returned. */
export async function timed<T>(work: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const started = performance.now();
  const value = await work();
  return { ms: performance.now() - started, value };
}
