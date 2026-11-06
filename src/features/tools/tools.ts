// AI-generated (Claude)
// The tools the Tools tab lists. A new tool is a screen under
// src/app/(tabs)/tools/ plus one entry here; the list renders from this table.

import type { Href } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

export type Tool = {
  key: string;
  title: string;
  /** One line under the title saying what the tool answers. */
  summary: string;
  systemImage: SFSymbol;
  href: Href;
};

export const TOOLS: readonly Tool[] = [
  {
    key: 'planner',
    title: 'Dive planner',
    summary: 'Runtime, stops and gas for a planned dive',
    systemImage: 'list.bullet.clipboard',
    href: '/tools/planner',
  },
  {
    key: 'gas',
    title: 'Gas calculator',
    summary: 'MOD and END of any mix, and the best mix for a depth',
    systemImage: 'cylinder.fill',
    href: '/tools/gas',
  },
  {
    key: 'nitrox',
    title: 'Nitrox',
    summary: 'MOD, best mix and no-deco limit against air',
    systemImage: 'percent',
    href: '/tools/nitrox',
  },
];
