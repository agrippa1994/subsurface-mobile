// AI-generated (Claude)
// Statistics - placeholder. The real screen (charts off getStatistics) is
// task 09; this keeps the tab honest until then.
import { StatusView } from '@/components/status-view';
import { useLogStore } from '@/store/log-store';

export default function StatisticsScreen() {
  const dives = useLogStore((state) => state.dives);

  return (
    <StatusView
      kind="empty"
      title="Statistics"
      description={`${dives.length} ${dives.length === 1 ? 'dive' : 'dives'} loaded. Charts and totals arrive in task 09.`}
      systemImage="chart.bar"
    />
  );
}
