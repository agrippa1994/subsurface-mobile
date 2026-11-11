// AI-generated (Claude)
// A label and a tonal minus and plus button, for the shared screens' steppers on
// Android. Inside a Compose list, see M3StepperRow in material/list.tsx.
import { Host } from '@/components/material/host';
import { FilledTonalIconButton, Row, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, weight } from '@expo/ui/jetpack-compose/modifiers';

import { M3Icon } from '@/components/material/icon';
import { t } from '@/i18n';

export function StepperRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <Host matchContents={{ vertical: true }}>
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 8 }}
        modifiers={[fillMaxWidth()]}>
        <Text style={{ typography: 'bodyLarge' }} modifiers={[weight(1)]}>
          {label}
        </Text>
        <FilledTonalIconButton
          enabled={value > min}
          onClick={() => onChange(Math.max(min, value - step))}>
          <M3Icon name="remove" label={t('charts.decrease', { label })} />
        </FilledTonalIconButton>
        <FilledTonalIconButton
          enabled={value < max}
          onClick={() => onChange(Math.min(max, value + step))}>
          <M3Icon name="add" label={t('charts.increase', { label })} />
        </FilledTonalIconButton>
      </Row>
    </Host>
  );
}
