// AI-generated (Claude)
// The surface GF timeline, Android variant: Material rows (components/material)
// with the Skia chart in the first section. Same state and texts as the iOS
// variant: use-surface-gf-screen.ts, src/models/surface-gf.ts.
import { Column, FlowRow, OutlinedButton, RNHostView, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { padding } from '@expo/ui/jetpack-compose/modifiers';
import { View } from 'react-native';

import { useSurfaceGfScreen, PRESSURE_SOURCE_OPTIONS } from './use-surface-gf-screen';
import {
  M3ActionRow,
  M3Footnote,
  M3MenuRow,
  M3Note,
  M3Screen,
  M3Section,
  M3SegmentedRow,
  M3StepperRow,
  M3SwitchRow,
  M3ValueRow,
} from '@/components/material/list';
import { M3WhenRows } from '@/components/material/when-rows';
import { StatusView } from '@/components/status-view';
import { SurfaceGfChart } from '@/components/surface-gf-chart';
import { useTheme } from '@/hooks/use-theme';
import { describeError, formatErrorLine } from '@/models/errors';
import {
  BELOW_THRESHOLDS,
  PLANNED_ENTRY_PRESETS,
  SINGLE_PRESSURE_NOTE,
  SURFACE_GF_DISCLAIMER,
  SURFACE_GF_EXPLAINER,
  TIMELINE_SPANS,
} from '@/models/surface-gf';

/** The Material date and time dialogs take the core's wall-clock seconds; these convert. */
function toWhen(ms: number): number {
  return Math.floor(ms / 1000) - new Date(ms).getTimezoneOffset() * 60;
}
function fromWhen(when: number): number {
  const guess = when * 1000;
  return guess + new Date(guess).getTimezoneOffset() * 60_000;
}

export function SurfaceGfScreen() {
  const screen = useSurfaceGfScreen();
  const palette = useMaterialColors();
  const theme = useTheme();
  const { timeline, surface, readout, window, planned } = screen;

  if (surface.error) {
    return (
      <StatusView
        kind="error"
        title="Surface GF is unavailable"
        description={formatErrorLine(describeError(surface.error))}
        systemImage="exclamationmark.triangle"
      />
    );
  }
  if (!timeline || !readout || !window) {
    return surface.isPending ? (
      <StatusView kind="loading" title="Working out the surface GF" />
    ) : (
      <StatusView
        kind="empty"
        title="No dives yet"
        description="The surface GF follows the latest dive in your logbook."
        systemImage="water.waves"
      />
    );
  }

  const aboveHigh = readout.gfText !== '-' && Number.parseInt(readout.gfText, 10) > surface.gfHigh;

  return (
    <M3Screen>
      <M3Section
        footer={`Dive #${timeline.diveNumber}. ${surface.ambient.label}.${timeline.residual ? ' Includes nitrogen from the dives before it.' : ''}`}>
        <Column modifiers={[padding(16, 12, 16, 4)]}>
          <Text color={aboveHigh ? theme.warning : palette.onSurface} style={{ typography: 'displayMedium' }}>
            {readout.gfText}
          </Text>
          <Text style={{ typography: 'titleMedium' }}>{readout.whenText}</Text>
          <Text color={palette.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>
            {readout.phaseText}
          </Text>
        </Column>
        <Column modifiers={[padding(16, 0, 16, 0)]}>
          <RNHostView matchContents>
            <View style={{ width: screen.chartWidth + 40 }}>
              <SurfaceGfChart
                timeline={timeline}
                fromMs={window.fromMs}
                toMs={window.toMs}
                yMax={screen.yMax}
                nowMs={screen.asOf}
                cursorMs={screen.cursorMs}
                onCursorChange={screen.setCursor}
                plannedMs={screen.settings.plannedEntryMs}
                gfHigh={surface.gfHigh}
                accessibilityLabel={`Surface GF over time. ${readout.accessibilityLabel}`}
              />
            </View>
          </RNHostView>
        </Column>
        <M3SegmentedRow
          options={TIMELINE_SPANS.map((span) => ({ value: span.key, label: span.label }))}
          value={screen.span}
          onChange={screen.setSpan}
        />
        <M3WhenRows
          value={toWhen(screen.cursorMs)}
          onChange={(when) => screen.setCursor(fromWhen(when))}
          dateLabel="Show the day"
          timeLabel="Show the time"
        />
        {screen.cursorFollowsNow ? null : (
          <M3ActionRow label="Back to now" icon="arrow.uturn.backward" onPress={screen.resetCursor} />
        )}
      </M3Section>

      {screen.pastSeries ? (
        <M3Section footer="The tissues were clean long before now, so the card on the dive list is hidden.">
          <M3ActionRow
            label="Look at it 30 min after the dive"
            icon="clock.arrow.circlepath"
            onPress={() => screen.setAsOfOverride(screen.asOfDefault)}
          />
        </M3Section>
      ) : null}

      <M3Section title="Next entry" footer="Kept on this phone as a preference, not in the logbook.">
        {planned ? (
          <M3ValueRow
            label={planned.whenText}
            value={planned.gf === null ? '-' : planned.gfText}
            color={planned.gf !== null && planned.gf > surface.gfHigh ? theme.warning : undefined}
          />
        ) : null}
        <M3WhenRows
          value={toWhen(screen.settings.plannedEntryMs ?? screen.asOf)}
          onChange={(when) => screen.setPlannedEntry(fromWhen(when))}
          dateLabel="Planned day"
          timeLabel="Planned time"
        />
        <FlowRow horizontalArrangement={{ spacedBy: 8 }} modifiers={[padding(16, 4, 16, 8)]}>
          {PLANNED_ENTRY_PRESETS.map((preset) => (
            <OutlinedButton key={preset.minutes} onClick={() => screen.applyPreset(preset.minutes)}>
              <Text>{preset.label}</Text>
            </OutlinedButton>
          ))}
        </FlowRow>
        {planned ? (
          <M3ActionRow label="Clear planned entry" destructive onPress={() => screen.setPlannedEntry(null)} />
        ) : null}
      </M3Section>

      <M3Section title="When below">
        <M3MenuRow
          label="Surface GF at or below"
          value={screen.threshold}
          options={BELOW_THRESHOLDS.map((value) => ({ value, label: `${value} %` }))}
          onChange={screen.setThreshold}
        />
        <M3Note>{screen.belowText ?? ''}</M3Note>
      </M3Section>

      <M3Section title="Ambient pressure" footer={SINGLE_PRESSURE_NOTE}>
        <M3SegmentedRow
          options={PRESSURE_SOURCE_OPTIONS}
          value={screen.settings.pressureSource}
          onChange={screen.setPressureSource}
        />
        {screen.settings.pressureSource === 'altitude' || surface.ambient.source !== 'barometer' ? (
          <M3StepperRow
            label={`Altitude  ${screen.altitudeText}`}
            value={screen.settings.altitudeMm}
            min={screen.altitudeRangeMm.min}
            max={screen.altitudeRangeMm.max}
            step={screen.altitudeStepMm}
            onChange={screen.setAltitudeMm}
          />
        ) : null}
        <M3ValueRow inline label="In use" value={surface.ambient.label} />
        {surface.ambient.fallbackNote ? (
          <M3Note color={theme.warning}>{surface.ambient.fallbackNote}</M3Note>
        ) : null}
      </M3Section>

      <M3Section
        title="Testing"
        footer="Follow an older dive, or pretend now is another time, to try the timeline on a log whose last dive was long ago.">
        <M3MenuRow
          label="Dive"
          value={screen.referenceValue}
          options={screen.referenceOptions}
          onChange={screen.setReference}
        />
        <M3SwitchRow
          label="As of another time"
          value={screen.asOfOverride !== null}
          onChange={(on) => screen.setAsOfOverride(on ? screen.asOfDefault : null)}
        />
        {screen.asOfOverride !== null ? (
          <M3WhenRows
            value={toWhen(screen.asOfOverride)}
            onChange={(when) => screen.setAsOfOverride(fromWhen(when))}
            dateLabel="As of day"
            timeLabel="As of time"
          />
        ) : null}
      </M3Section>

      <M3Section footer={SURFACE_GF_DISCLAIMER}>
        <M3Note color={palette.onSurfaceVariant}>{SURFACE_GF_EXPLAINER}</M3Note>
      </M3Section>
      <M3Footnote>{' '}</M3Footnote>
    </M3Screen>
  );
}
