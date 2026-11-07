// AI-generated (Claude)
// What the screens of the Statistics stack share: the filter, which the overview and
// every chart answer to alike, and the dives a chart item leads to.
//
// The dives go here rather than into the route's params: a bar can stand for thousands
// of dives, and ids are not worth a trip through a URL. The filter lasts as long as the
// stack does, as it did on the overview alone.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { NO_FILTER, type StatsFilterInput } from '@/models/statistics';

export type DivesBehindChart = { title: string; ids: readonly number[] };

type StatisticsContextValue = {
  filter: StatsFilterInput;
  setFilter: (update: (current: StatsFilterInput) => StatsFilterInput) => void;
  behind: DivesBehindChart | null;
  setBehind: (dives: DivesBehindChart | null) => void;
};

const StatisticsContext = createContext<StatisticsContextValue | null>(null);

export function StatisticsProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<StatsFilterInput>(NO_FILTER);
  const [behind, setBehind] = useState<DivesBehindChart | null>(null);
  const value = useMemo(() => ({ filter, setFilter, behind, setBehind }), [filter, behind]);
  return <StatisticsContext.Provider value={value}>{children}</StatisticsContext.Provider>;
}

export function useStatisticsContext(): StatisticsContextValue {
  const value = useContext(StatisticsContext);
  if (!value) {
    throw new Error('useStatisticsContext outside the Statistics stack');
  }
  return value;
}
