// AI-generated (Claude)
// Writes the Material Symbols the Compose screens draw to assets/material-symbols,
// and the table of them to src/components/material/icon-assets.ts.
//
// Compose's Icon draws an Android vector drawable, not the font expo-symbols uses,
// so each symbol is a file the bundler has to see through a static require. The
// names come from MATERIAL_SYMBOLS in src/components/symbol.tsx, plus EXTRA below for
// what only Compose draws. Run it after adding a symbol there:
//
//   node scripts/fetch-material-icons.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'assets/material-symbols');
const TABLE = join(ROOT, 'src/components/material/icon-assets.ts');
const BASE = 'https://raw.githubusercontent.com/google/material-design-icons/master/symbols/android';

/** Drawn by the Compose screens without an SF Symbol to go through. */
const EXTRA = ['arrow_drop_down', 'check_box', 'check_box_outline_blank', 'remove', 'star_half'];

const source = readFileSync(join(ROOT, 'src/components/symbol.tsx'), 'utf8');
const names = [...source.matchAll(/^\s+['\w.]+: '(\w+)',$/gm)].map((match) => match[1]);
const all = [...new Set([...names, ...EXTRA])].sort();

/** Names expo-symbols knows from the older icon set, and what the symbols set calls them. */
const RENAMED = { star_outline: 'star', remove_circle_outline: 'do_not_disturb_on' };
const FILLED = new Set(['star', 'check_box', 'check_circle']);

mkdirSync(OUT, { recursive: true });
for (const name of all) {
  const file = join(OUT, `${name}.xml`);
  if (existsSync(file)) {
    continue;
  }
  const remote = RENAMED[name] ?? name;
  const variant = FILLED.has(name) ? `${remote}_fill1_24px` : `${remote}_24px`;
  const response = await fetch(`${BASE}/${remote}/materialsymbolsoutlined/${variant}.xml`);
  if (!response.ok) {
    throw new Error(`${name}: HTTP ${response.status}`);
  }
  writeFileSync(file, await response.text());
}

const rows = all.map((name) => `  ${name}: require('@/assets/material-symbols/${name}.xml'),`);
writeFileSync(
  TABLE,
  `// AI-generated (Claude)
// Written by scripts/fetch-material-icons.mjs; do not edit by hand.
import type { ImageSourcePropType } from 'react-native';

export const ICON_ASSETS = {
${rows.join('\n')}
} satisfies Record<string, ImageSourcePropType>;

export type MaterialIconName = keyof typeof ICON_ASSETS;
`,
);
console.log(`${all.length} symbols`);
