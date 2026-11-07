// AI-generated (Claude)
// Useful questions and the way to a chart of one's own, as a Compose list.
import { M3ActionRow, M3Screen, M3Section } from '@/components/material/list';
import { useExploreScreen } from '@/features/statistics/use-explore-screen';

export default function ExploreScreen() {
  const screen = useExploreScreen();
  return (
    <M3Screen>
      <M3Section title="Your chart">
        {screen.last ? (
          <M3ActionRow
            icon="chart.xyaxis.line"
            label={screen.last.title}
            detail={screen.last.detail}
            opens
            onPress={screen.openLast}
          />
        ) : null}
        <M3ActionRow
          icon="slider.horizontal.3"
          label="Build your own"
          detail="Choose what to compare and how to show it"
          opens
          onPress={screen.build}
        />
      </M3Section>
      <M3Section title="Questions">
        {screen.presets.map((preset) => (
          <M3ActionRow
            key={preset.key}
            icon={preset.icon}
            label={preset.title}
            detail={preset.detail}
            opens
            onPress={() => screen.openPreset(preset)}
          />
        ))}
      </M3Section>
    </M3Screen>
  );
}
