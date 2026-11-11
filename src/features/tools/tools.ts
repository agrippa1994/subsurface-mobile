// AI-generated (Claude)
// The tools the Tools tab lists. A new tool is a screen under
// src/app/(tabs)/tools/ plus one entry here; the list renders from this table.

import type { Href } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';
import { t } from '@/i18n';

export type Tool = {
  key: string;
  readonly title: string;
  /** One line under the title saying what the tool answers. */
  readonly summary: string;
  systemImage: SFSymbol;
  href: Href;
};

/** A tool whose words are looked up when read. */
function tool(key: 'planner' | 'gas' | 'nitrox' | 'surfaceGf', rest: Omit<Tool, 'key' | 'title' | 'summary'> & { key: string }): Tool {
  return {
    ...rest,
    get title() {
      return t(`tools.${key}.title`);
    },
    get summary() {
      return t(`tools.${key}.summary`);
    },
  };
}

export const TOOLS: readonly Tool[] = [
  tool('planner', {
    key: 'planner',
    systemImage: 'list.bullet.clipboard',
    href: '/tools/planner',
  }),
  tool('gas', {
    key: 'gas',
    systemImage: 'cylinder.fill',
    href: '/tools/gas',
  }),
  tool('nitrox', {
    key: 'nitrox',
    systemImage: 'percent',
    href: '/tools/nitrox',
  }),
  tool('surfaceGf', {
    key: 'surface-gf',
    systemImage: 'chart.line.downtrend.xyaxis',
    href: '/tools/surface-gf',
  }),
];
