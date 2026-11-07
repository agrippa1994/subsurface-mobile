// AI-generated (Claude)
// Every Material Symbol the app can name has to be a file the Compose screens can draw.
// A symbol added to the table without running the fetch script would draw as nothing,
// on Android only, which no other test here would notice.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../../..');
const source = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('material symbol assets', () => {
  const symbols = [...source('src/components/symbol.tsx').matchAll(/^\s+['\w.]+: '(\w+)',$/gm)].map(
    (match) => match[1],
  );
  const table = [
    ...source('src/components/material/icon-assets.ts').matchAll(/^\s+(\w+): require\(/gm),
  ].map((match) => match[1]);

  it('finds the tables', () => {
    expect(symbols.length).toBeGreaterThan(50);
  });

  it.each(symbols)('%s is in the table', (name) => {
    expect(table).toContain(name);
  });

  it.each(table)('%s has its file', (name) => {
    expect(existsSync(join(ROOT, `assets/material-symbols/${name}.xml`))).toBe(true);
  });
});
