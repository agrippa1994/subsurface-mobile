// AI-generated (Claude)
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

// The universal native Picker currently offers menu/wheel only. These two
// persistent tabs mirror SSI's selector and keep map/list actions visible.
export function SsiSiteTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: theme.text,
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option.value }}
          onPress={() => onChange(option.value)}
          style={{
            flex: 1,
            padding: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: value === option.value ? theme.text : theme.background,
          }}
        >
          <Text
            style={{
              color: value === option.value ? theme.background : theme.text,
              fontWeight: '600',
              textAlign: 'center',
            }}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
