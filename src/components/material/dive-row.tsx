// AI-generated (Claude)
// One dive as a Compose list item: the number in a tonal badge, title over subtitle and
// stars, depth over duration at the end. What the texts say is decided by the
// presentation model (models/dive-list.ts), never here.
import {
  Checkbox,
  Column,
  ListItem,
  Row,
  Surface,
  Text,
  useMaterialColors,
} from '@expo/ui/jetpack-compose';
import {
  clip,
  combinedClickable,
  defaultMinSize,
  padding,
  semantics,
  Shapes,
} from '@expo/ui/jetpack-compose/modifiers';

import type { DiveRow } from '@/models/dive-list';

import { M3Icon } from './icon';

const STAR_COLOR = '#FFB300';

export function M3DiveRow({
  row,
  onPress,
  onLongPress,
  selected,
  open = false,
}: {
  row: DiveRow;
  onPress: () => void;
  onLongPress?: () => void;
  /** Whether the list's selection holds this row; absent outside selection mode. */
  selected?: boolean;
  /** Whether this dive is the one open beside the list, on a tablet. */
  open?: boolean;
}) {
  const palette = useMaterialColors();
  const subtitle = [row.subtitle, row.planned ? 'planned' : '', row.invalid ? 'invalid' : '']
    .filter(Boolean)
    .join('  ');
  return (
    <ListItem
      colors={{ containerColor: open ? palette.secondaryContainer : 'transparent' }}
      modifiers={[
        combinedClickable({ onClick: onPress, onLongClick: onLongPress }),
        semantics({ contentDescription: row.accessibilityLabel }),
      ]}>
      <ListItem.LeadingContent>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
          {selected !== undefined ? <Checkbox value={selected} onCheckedChange={onPress} /> : null}
          <Surface
            color={palette.secondaryContainer}
            contentColor={palette.onSecondaryContainer}
            modifiers={[clip(Shapes.RoundedCorner(8))]}>
            <Text
              style={{ typography: 'labelLarge', textAlign: 'center' }}
              modifiers={[defaultMinSize({ minWidth: 44 }), padding(8, 6, 8, 6)]}>
              {row.badgeText}
            </Text>
          </Surface>
        </Row>
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <Text maxLines={1} overflow="ellipsis">
          {row.title}
        </Text>
      </ListItem.HeadlineContent>
      {subtitle !== '' || row.rating > 0 ? (
        <ListItem.SupportingContent>
          <Column>
            {subtitle !== '' ? (
              <Text maxLines={1} overflow="ellipsis">
                {subtitle}
              </Text>
            ) : null}
            {row.rating > 0 ? (
              <Row>
                {Array.from({ length: row.rating }, (_, index) => (
                  <M3Icon key={index} symbol="star.fill" size={14} tint={STAR_COLOR} />
                ))}
              </Row>
            ) : null}
          </Column>
        </ListItem.SupportingContent>
      ) : null}
      <ListItem.TrailingContent>
        <Column horizontalAlignment="end">
          {row.depthText !== '' ? (
            <Text color={palette.onSurface} style={{ typography: 'bodyLarge' }}>
              {row.depthText}
            </Text>
          ) : null}
          {row.durationText !== '' ? (
            <Text color={palette.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>
              {row.durationText}
            </Text>
          ) : null}
        </Column>
      </ListItem.TrailingContent>
    </ListItem>
  );
}
