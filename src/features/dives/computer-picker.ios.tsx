// AI-generated (Claude)
// Switches the dive computer a dive is shown from, iOS variant: a SwiftUI menu
// holding an inline picker, which is what draws the checkmark. A menu rather than
// a segmented control, because computer names run to 25 characters or more
// ("Heinrichs Weikamp OSTC 2N") and a dive can have any number of them: segments
// would truncate the very thing they have to show. Its label is drawn here rather
// than by a menu-style Picker, which wraps a long name onto a second line that the
// surrounding Host does not grow to fit.
import { Button, Divider, Host, HStack, Image, Menu, Picker, Spacer, Text } from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  accessibilityLabel,
  accessibilityValue,
  font,
  foregroundStyle,
  lineLimit,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';

import { useTheme } from '@/hooks/use-theme';
import { computerPositionText } from '@/models/dive-computers';

import { MAKE_FIRST_LABEL, type ComputerPickerProps } from './computer-picker';

export function ComputerPicker({
  labels,
  selectedIndex,
  onSelect,
  compact = false,
  onMakeFirst,
}: ComputerPickerProps) {
  const theme = useTheme();
  const canMakeFirst = onMakeFirst !== undefined && selectedIndex > 0;
  const menu = (
    <Menu
      label={
        <HStack spacing={4}>
          <Text modifiers={[lineLimit(1), foregroundStyle(theme.accent)]}>
            {labels[selectedIndex]}
          </Text>
          <Image
            systemName="chevron.up.chevron.down"
            modifiers={[font({ size: 13 }), foregroundStyle(theme.accent)]}
          />
        </HStack>
      }
      modifiers={[
        accessibilityLabel('Dive computer'),
        accessibilityValue(
          computerPositionText(labels[selectedIndex], selectedIndex, labels.length),
        ),
        accessibilityHint('Shows the profile and details from another computer'),
      ]}
    >
      <Picker
        label="Dive computer"
        selection={selectedIndex}
        onSelectionChange={(index: number) => onSelect(index)}
        modifiers={[pickerStyle('inline')]}
      >
        {labels.map((label, index) => (
          <Text key={index} modifiers={[tag(index)]}>
            {label}
          </Text>
        ))}
      </Picker>
      {canMakeFirst ? <Divider /> : null}
      {canMakeFirst ? (
        <Button
          label={MAKE_FIRST_LABEL}
          systemImage="arrow.up.to.line"
          onPress={() => onMakeFirst(selectedIndex)}
        />
      ) : null}
    </Menu>
  );

  if (compact) {
    return <Host matchContents>{menu}</Host>;
  }
  return (
    <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
      <HStack>
        <Text modifiers={[lineLimit(1)]}>Computer</Text>
        <Spacer />
        {menu}
      </HStack>
    </Host>
  );
}
