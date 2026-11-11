// AI-generated (Claude)
// The surface GF timeline, iOS variant: a native Form with the Skia chart in its
// first section. State: use-surface-gf-screen.ts; numbers and texts:
// src/models/surface-gf.ts; the series: `surfaceGf` in the core bindings.
import {
  Button,
  DatePicker,
  Form,
  Host,
  HStack,
  LabeledContent,
  Picker,
  RNHostView,
  Section,
  Stepper,
  Text,
  Toggle,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  monospacedDigit,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { useSurfaceGfScreen, PRESSURE_SOURCE_OPTIONS } from './use-surface-gf-screen';
import { StatusView } from '@/components/status-view';
import { SurfaceGfChart } from '@/components/surface-gf-chart';
import { useTheme } from '@/hooks/use-theme';
import { describeError, formatErrorLine } from '@/models/errors';
import {
  BELOW_THRESHOLDS,
  formatGf,
  PLANNED_ENTRY_PRESETS,
  singlePressureNote,
  surfaceGfDisclaimer,
  surfaceGfExplainer,
  TIMELINE_SPANS,
  type PressureSource,
  type TimelineSpanKey,
} from '@/models/surface-gf';
import { t } from '@/i18n';

const SECONDARY = { type: 'hierarchical', style: 'secondary' } as const;

export function SurfaceGfScreen() {
  const screen = useSurfaceGfScreen();
  const theme = useTheme();
  const { timeline, surface, readout, window, planned } = screen;

  if (surface.error) {
    return (
      <StatusView
        kind="error"
        title={t('ui.surfaceGfIsUnavailable')}
        description={formatErrorLine(describeError(surface.error))}
        systemImage="exclamationmark.triangle"
      />
    );
  }
  if (!timeline || !readout || !window) {
    return surface.isPending ? (
      <StatusView kind="loading" title={t('ui.workingOutTheSurfaceGf')} />
    ) : (
      <StatusView
        kind="empty"
        title={t('ui.noDivesYet')}
        description={t('ui.theSurfaceGfFollowsTheLatest')}
        systemImage="water.waves"
      />
    );
  }

  return (
    <Host style={{ flex: 1 }} useViewportSizeMeasurement>
      <Form>
        <Section
          footer={
            <Text>{`${t('surfaceGfScreen.diveNumber', { number: timeline.diveNumber })} ${surface.ambient.label}.${timeline.residual ? ` ${t('surfaceGfScreen.residual')}` : ''}`}</Text>
          }>
          <VStack alignment="leading" spacing={2} modifiers={[accessibilityLabel(readout.accessibilityLabel)]}>
            <Text
              modifiers={[
                font({ size: 56, weight: 'bold', design: 'rounded' }),
                monospacedDigit(),
                ...(readout.gfText !== '-' && Number.parseInt(readout.gfText, 10) > surface.gfHigh
                  ? [foregroundStyle(theme.warning)]
                  : []),
              ]}>
              {readout.gfText}
            </Text>
            <Text modifiers={[font({ textStyle: 'headline' }), monospacedDigit()]}>{readout.whenText}</Text>
            <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(SECONDARY)]}>
              {readout.phaseText}
            </Text>
          </VStack>
          <RNHostView matchContents>
            <View style={{ width: screen.chartWidth }}>
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
                accessibilityLabel={`${t('surfaceGfScreen.overTime')} ${readout.accessibilityLabel}`}
              />
            </View>
          </RNHostView>
          <Picker
            label={t('ui.span')}
            selection={screen.span}
            onSelectionChange={(value: string) => screen.setSpan(value as TimelineSpanKey)}
            modifiers={[pickerStyle('segmented')]}>
            {TIMELINE_SPANS.map((span) => (
              <Text key={span.key} modifiers={[tag(span.key)]}>
                {span.label}
              </Text>
            ))}
          </Picker>
          <DatePicker
            title={t('ui.showTheTime')}
            selection={new Date(screen.cursorMs)}
            displayedComponents={['date', 'hourAndMinute']}
            range={{ start: new Date(timeline.startMs), end: new Date(timeline.endMs) }}
            onDateChange={(date) => screen.setCursor(date.getTime())}
          />
          {screen.cursorFollowsNow ? null : (
            <Button label={t('ui.backToNow')} systemImage="arrow.uturn.backward" onPress={screen.resetCursor} />
          )}
        </Section>

        {screen.pastSeries ? (
          <Section footer={<Text>{t('ui.theTissuesWereCleanLongBefore')}</Text>}>
            <Button
              label={t('ui.lookAtIt30MinAfter')}
              systemImage="clock.arrow.circlepath"
              onPress={() => screen.setAsOfOverride(screen.asOfDefault)}
            />
          </Section>
        ) : null}

        <Section title={t('ui.nextEntry')} footer={<Text>{t('ui.keptOnThisPhoneAsA')}</Text>}>
          {planned ? (
            <LabeledContent label={planned.whenText}>
              <Text
                modifiers={[
                  font({ textStyle: 'title2', weight: 'bold', design: 'rounded' }),
                  monospacedDigit(),
                  ...(planned.gf !== null && planned.gf > surface.gfHigh ? [foregroundStyle(theme.warning)] : []),
                ]}>
                {planned.gf === null ? '-' : formatGf(planned.gf)}
              </Text>
            </LabeledContent>
          ) : null}
          <DatePicker
            title={t('ui.plannedEntry')}
            selection={new Date(screen.settings.plannedEntryMs ?? screen.asOf)}
            displayedComponents={['date', 'hourAndMinute']}
            onDateChange={(date) => screen.setPlannedEntry(date.getTime())}
          />
          <HStack spacing={8}>
            {PLANNED_ENTRY_PRESETS.map((preset) => (
              <Button
                key={preset.minutes}
                label={preset.label}
                onPress={() => screen.applyPreset(preset.minutes)}
                modifiers={[buttonStyle('bordered'), controlSize('small')]}
              />
            ))}
          </HStack>
          {planned ? (
            <Button label={t('ui.clearPlannedEntry')} role="destructive" onPress={() => screen.setPlannedEntry(null)} />
          ) : null}
        </Section>

        <Section title={t('ui.whenBelow')}>
          <Picker
            label={t('ui.surfaceGfAtOrBelow')}
            selection={screen.threshold}
            onSelectionChange={(value: number) => screen.setThreshold(value)}
            modifiers={[pickerStyle('menu')]}>
            {BELOW_THRESHOLDS.map((value) => (
              <Text key={value} modifiers={[tag(value)]}>
                {`${value} %`}
              </Text>
            ))}
          </Picker>
          <Text modifiers={[monospacedDigit()]}>{screen.belowText ?? ''}</Text>
        </Section>

        <Section title={t('ui.ambientPressure')} footer={<Text>{singlePressureNote()}</Text>}>
          <Picker
            label={t('ui.source')}
            selection={screen.settings.pressureSource}
            onSelectionChange={(value: string) => screen.setPressureSource(value as PressureSource)}
            modifiers={[pickerStyle('segmented')]}>
            {PRESSURE_SOURCE_OPTIONS.map((option) => (
              <Text key={option.value} modifiers={[tag(option.value)]}>
                {option.label}
              </Text>
            ))}
          </Picker>
          {screen.settings.pressureSource === 'altitude' || surface.ambient.source !== 'barometer' ? (
            <Stepper
              label={`${t('ui.altitude')}  ${screen.altitudeText}`}
              value={screen.settings.altitudeMm}
              min={screen.altitudeRangeMm.min}
              max={screen.altitudeRangeMm.max}
              step={screen.altitudeStepMm}
              onValueChange={screen.setAltitudeMm}
            />
          ) : null}
          <LabeledContent label={t('ui.inUse')}>
            <Text modifiers={[monospacedDigit()]}>{surface.ambient.label}</Text>
          </LabeledContent>
          {surface.ambient.fallbackNote ? (
            <Text modifiers={[font({ textStyle: 'footnote' }), foregroundStyle(theme.warning)]}>
              {surface.ambient.fallbackNote}
            </Text>
          ) : null}
        </Section>

        <Section
          title={t('ui.testing')}
          footer={
            <Text>
              {t('ui.followAnOlderDiveOrPretend')}
            </Text>
          }>
          <Picker
            label={t('ui.dive')}
            selection={screen.referenceValue}
            onSelectionChange={(value: number) => screen.setReference(value)}
            modifiers={[pickerStyle('menu')]}>
            {screen.referenceOptions.map((option) => (
              <Text key={option.value} modifiers={[tag(option.value)]}>
                {option.label}
              </Text>
            ))}
          </Picker>
          <Toggle
            label={t('ui.asOfAnotherTime')}
            isOn={screen.asOfOverride !== null}
            onIsOnChange={(on: boolean) => screen.setAsOfOverride(on ? screen.asOfDefault : null)}
          />
          {screen.asOfOverride !== null ? (
            <DatePicker
              title={t('ui.asOf')}
              selection={new Date(screen.asOfOverride)}
              displayedComponents={['date', 'hourAndMinute']}
              onDateChange={(date) => screen.setAsOfOverride(date.getTime())}
            />
          ) : null}
        </Section>

        <Section footer={<Text>{surfaceGfDisclaimer()}</Text>}>
          <Text modifiers={[font({ textStyle: 'footnote' }), foregroundStyle(SECONDARY)]}>{surfaceGfExplainer()}</Text>
        </Section>
      </Form>
    </Host>
  );
}
