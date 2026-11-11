// AI-generated (Claude)
// The start of a dive, portable variant: steppers, as on the portable planner. iOS has
// the native pickers, see when-field.ios.tsx.
import { StepperRow } from '@/components/stepper-row';
import { formatWhen } from '@/models/planner';
import { t } from '@/i18n';

export function WhenField({
  value,
  onChange,
}: {
  value: number;
  onChange: (when: number) => void;
}) {
  return (
    <>
      <StepperRow
        label={`${t('toolsScreen.day')}  ${formatWhen(value)}`}
        value={value}
        min={0}
        max={Number.MAX_SAFE_INTEGER}
        step={86400}
        onChange={onChange}
      />
      <StepperRow
        label={t('ui.timeBy5Min')}
        value={value}
        min={0}
        max={Number.MAX_SAFE_INTEGER}
        step={300}
        onChange={onChange}
      />
    </>
  );
}
