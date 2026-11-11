// AI-generated (Claude)
// One cylinder of the plan, Android variant, in Compose. The tanks are the core's table.
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { Stack } from 'expo-router';

import {
  M3ActionRow,
  M3MenuRow,
  M3Note,
  M3Screen,
  M3Section,
  M3SegmentedRow,
  M3StepperRow,
} from '@/components/material/list';
import { StatusView } from '@/components/status-view';
import { USE_OPTIONS, usePlannerCylinderScreen } from '@/features/tools/use-planner-cylinder-screen';
import { gasName } from '@/models/planner';
import { t } from '@/i18n';

export default function PlannerCylinderScreen() {
  const screen = usePlannerCylinderScreen();
  const palette = useMaterialColors();
  const { cylinder } = screen;
  if (!cylinder) {
    return <StatusView kind="empty" title={t('ui.thisCylinderIsNoLongerIn')} />;
  }
  const name = gasName(cylinder.o2Percent, cylinder.hePercent);

  return (
    <>
      <Stack.Screen options={{ title: name }} />
      <M3Screen>
        <M3Section title={t('ui.cylinder')}>
          <M3MenuRow
            label={t('ui.type')}
            value={cylinder.tank}
            options={screen.tanks.map((tank) => ({ value: tank.name, label: tank.name }))}
            onChange={screen.setTank}
          />
          <M3StepperRow
            label={`${t('toolsScreen.filledTo')}  ${screen.fill} ${screen.fillUnit}`}
            value={screen.fill}
            min={screen.fillRange.min}
            max={screen.fillRange.max}
            step={screen.fillRange.step}
            onChange={screen.setFill}
          />
          {screen.showUse ? (
            <M3SegmentedRow
              label={t('ui.use')}
              options={USE_OPTIONS}
              value={cylinder.use}
              onChange={screen.setUse}
            />
          ) : null}
        </M3Section>

        <M3Section title={t('ui.gas')}>
          <M3MenuRow
            label={t('ui.mix')}
            value={name}
            shown={name}
            options={screen.presets.map((preset) => ({ value: preset.label, label: preset.label }))}
            onChange={screen.setPreset}
          />
          <M3StepperRow
            label={`${t('toolsScreen.oxygen')}  ${cylinder.o2Percent}%`}
            value={cylinder.o2Percent}
            min={5}
            max={100}
            step={1}
            onChange={screen.setO2}
          />
          <M3StepperRow
            label={`${t('toolsScreen.helium')}  ${cylinder.hePercent}%`}
            value={cylinder.hePercent}
            min={0}
            max={95}
            step={1}
            onChange={screen.setHe}
          />
          {screen.bestLabel ? <M3ActionRow label={screen.bestLabel} onPress={screen.applyBest} /> : null}
        </M3Section>

        <M3Section>
          {screen.canRemove ? (
            <M3ActionRow label={t('ui.removeCylinder')} destructive onPress={screen.remove} />
          ) : (
            <M3Note color={palette.onSurfaceVariant}>
              {screen.inUse
                ? 'A level breathes from this cylinder, so it cannot be removed.'
                : 'A plan needs at least one cylinder.'}
            </M3Note>
          )}
        </M3Section>
      </M3Screen>
    </>
  );
}
