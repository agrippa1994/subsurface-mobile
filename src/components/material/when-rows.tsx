// AI-generated (Claude)
// A dive's start as two rows, each opening Material's own dialog: the date picker and
// the time picker. iOS has one native DatePicker row for both.
//
// A `when` is the core's: seconds whose UTC fields read as the local wall clock (see
// whenToDate in models/planner.ts). The date dialog works in UTC days, so it takes and
// gives those fields directly. The time dialog works in the device's zone, so it gets
// the matching real instant, and only its hour and minute are read back.
import {
  DatePickerDialog,
  ListItem,
  Text,
  TimePickerDialog,
  useMaterialColors,
} from '@expo/ui/jetpack-compose';
import { clickable } from '@expo/ui/jetpack-compose/modifiers';
import { useState } from 'react';

import { M3Icon } from './icon';

import { formatDiveDateMedium, formatDiveTime, uses24HourClock } from '@/models/date-format';
import { whenToDate } from '@/models/planner';

const SECONDS_PER_DAY = 86400;

const formatDay = formatDiveDateMedium;
const formatTime = formatDiveTime;

const secondsIntoDay = (when: number) => ((when % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;

const uses24Hours = uses24HourClock;

function Row({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon: 'calendar_month' | 'schedule';
  onPress: () => void;
}) {
  const palette = useMaterialColors();
  return (
    <ListItem colors={{ containerColor: 'transparent' }} modifiers={[clickable(onPress)]}>
      <ListItem.HeadlineContent>
        <Text>{label}</Text>
      </ListItem.HeadlineContent>
      <ListItem.SupportingContent>
        <Text>{value}</Text>
      </ListItem.SupportingContent>
      <ListItem.TrailingContent>
        <M3Icon name={icon} tint={palette.primary} />
      </ListItem.TrailingContent>
    </ListItem>
  );
}

export function M3WhenRows({
  value,
  onChange,
  dateLabel = 'Date',
  timeLabel = 'Time',
}: {
  value: number;
  onChange: (when: number) => void;
  dateLabel?: string;
  timeLabel?: string;
}) {
  const [open, setOpen] = useState<'date' | 'time' | null>(null);
  return (
    <>
      <Row label={dateLabel} value={formatDay(value)} icon="calendar_month" onPress={() => setOpen('date')} />
      <Row label={timeLabel} value={formatTime(value)} icon="schedule" onPress={() => setOpen('time')} />
      {open === 'date' ? (
        <DatePickerDialog
          initialDate={new Date(value * 1000).toISOString()}
          onDismissRequest={() => setOpen(null)}
          onDateSelected={(date) => {
            setOpen(null);
            onChange(Math.floor(date.getTime() / 1000) + secondsIntoDay(value));
          }}
        />
      ) : null}
      {open === 'time' ? (
        <TimePickerDialog
          initialDate={whenToDate(value).toISOString()}
          is24Hour={uses24Hours()}
          onDismissRequest={() => setOpen(null)}
          onDateSelected={(date) => {
            setOpen(null);
            onChange(
              value -
                secondsIntoDay(value) +
                date.getHours() * 3600 +
                date.getMinutes() * 60 +
                (value % 60),
            );
          }}
        />
      ) : null}
    </>
  );
}
