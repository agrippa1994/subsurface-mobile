// AI-generated (Claude)
// The start of a dive, iOS variant: the system's compact date and time pickers. The
// form is React Native (see components/form.tsx), so the picker brings its own Host.
import { DatePicker, Host } from '@expo/ui/swift-ui';

import { whenFromDate, whenToDate } from '@/models/planner';
import { t } from '@/i18n';

export function WhenField({
  value,
  onChange,
}: {
  value: number;
  onChange: (when: number) => void;
}) {
  return (
    <Host matchContents={{ vertical: true }} style={{ minHeight: 34 }}>
      <DatePicker
        title={t('ui.dateAndTime')}
        selection={whenToDate(value)}
        displayedComponents={['date', 'hourAndMinute']}
        onDateChange={(date) => onChange(whenFromDate(date))}
      />
    </Host>
  );
}
