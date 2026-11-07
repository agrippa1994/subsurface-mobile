// AI-generated (Claude)
// The start of a dive on Android: rows opening the date and time dialogs.
import { Host } from '@/components/material/host';
import { Column } from '@expo/ui/jetpack-compose';

import { M3WhenRows } from '@/components/material/when-rows';

export function WhenField({
  value,
  onChange,
}: {
  value: number;
  onChange: (when: number) => void;
}) {
  return (
    // The list items bring their own margin; the form's has already been given.
    <Host matchContents={{ vertical: true }} style={{ marginHorizontal: -16 }}>
      <Column>
        <M3WhenRows value={value} onChange={onChange} />
      </Column>
    </Host>
  );
}
