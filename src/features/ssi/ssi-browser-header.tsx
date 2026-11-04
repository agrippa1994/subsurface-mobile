// AI-generated (Claude)
import { Stack } from 'expo-router';
import type {
  NativeStackHeaderItem,
  NativeStackHeaderItemMenuAction,
  NativeStackNavigationOptions,
} from 'expo-router/native-stack';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SsiBrowserView = 'nearby' | 'map' | 'list';
export type SsiBrowserHeaderProps = {
  title: string;
  view: SsiBrowserView;
  sort: 'distance' | 'recent';
  onViewChange: (view: SsiBrowserView) => void;
  onSortChange: (sort: 'distance' | 'recent') => void;
  onSearch: (text: string) => void;
  onLocate: () => void;
  locating: boolean;
  onBack?: () => void;
  onClose?: () => void;
  onMySites?: () => void;
  onDetails?: () => void;
  onSelect?: () => void;
  showingDetail: boolean;
  mapsAvailable: boolean;
};

// Native bar items use the same UIKit rendering as Stack.Toolbar elsewhere.
// Both the Sites tab and the modal picker use this shared header configuration.
export function SsiBrowserHeader(props: SsiBrowserHeaderProps) {
  const theme = useTheme();
  const action = (
    label: string,
    onPress: () => void,
    selected = false,
  ): NativeStackHeaderItemMenuAction => ({
    type: 'action',
    label,
    onPress,
    state: selected ? 'on' : 'off',
  });
  const items: NativeStackHeaderItemMenuAction[] = [
    ...(props.onMySites
      ? [
          action('My dive sites', () => props.onMySites?.()),
          action(
            'SSI dive sites',
            () => props.onViewChange(props.mapsAvailable ? 'map' : 'list'),
            true,
          ),
        ]
      : []),
    ...(props.mapsAvailable
      ? [action('Map', () => props.onViewChange('map'), props.view === 'map')]
      : []),
    action('List', () => props.onViewChange('list'), props.view === 'list'),
    action(
      'By distance',
      () => {
        props.onSortChange('distance');
        props.onViewChange('nearby');
      },
      props.view === 'nearby' && props.sort === 'distance',
    ),
    action(
      'Recently used',
      () => {
        props.onSortChange('recent');
        props.onViewChange('nearby');
      },
      props.view === 'nearby' && props.sort === 'recent',
    ),
    action(props.locating ? 'Finding location…' : 'Use my location', props.onLocate),
  ];
  const right: NativeStackHeaderItem[] = [];
  if (props.onSelect)
    right.push({
      type: 'button',
      label: 'Select dive site',
      icon: { type: 'sfSymbol', name: 'checkmark' },
      variant: 'done',
      onPress: () => props.onSelect?.(),
    });
  if (props.onDetails)
    right.push({
      type: 'button',
      label: 'SSI site details',
      icon: { type: 'sfSymbol', name: 'info.circle' },
      onPress: () => props.onDetails?.(),
    });
  if (!props.showingDetail)
    right.push({
      type: 'menu',
      label: 'Site options',
      icon: { type: 'sfSymbol', name: 'line.3.horizontal.decrease' },
      menu: { items },
    });
  const left: NativeStackHeaderItem[] = [];
  if (props.onBack)
    left.push({
      type: 'button',
      label: 'Back to sites',
      icon: { type: 'sfSymbol', name: 'chevron.left' },
      onPress: () => props.onBack?.(),
    });
  if (props.onClose)
    left.push({ type: 'button', label: 'Cancel', onPress: () => props.onClose?.() });
  const fallbackButton = (label: string, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={Spacing.two}
      style={{ padding: Spacing.two }}
    >
      <Text style={{ color: theme.accent }}>{label}</Text>
    </Pressable>
  );
  const options: NativeStackNavigationOptions = {
    title: props.title,
    headerLargeTitle: false,
    headerTransparent: props.view === 'map' && !props.showingDetail,
    headerSearchBarOptions: props.showingDetail
      ? undefined
      : {
          placeholder: 'Search SSI dive sites',
          hideWhenScrolling: false,
          hideNavigationBar: false,
          placement: 'stacked',
          onChangeText: (event) => props.onSearch(event.nativeEvent.text),
          onCancelButtonPress: () => props.onSearch(''),
        },
    ...(Platform.OS === 'ios'
      ? {
          unstable_headerLeftItems: () => left,
          unstable_headerRightItems: () => right,
        }
      : {
          headerLeft: () => (
            <View style={{ flexDirection: 'row' }}>
              {props.onBack ? fallbackButton('Back', props.onBack) : null}
              {props.onClose ? fallbackButton('Cancel', props.onClose) : null}
            </View>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              {props.onSelect ? fallbackButton('Select', props.onSelect) : null}
              {props.onDetails ? fallbackButton('Details', props.onDetails) : null}
              {!props.showingDetail
                ? fallbackButton('Options', () =>
                    Alert.alert('Site options', undefined, [
                      {
                        text: 'Browse sites',
                        onPress: () =>
                          Alert.alert('Browse sites', undefined, [
                            { text: 'All sites', onPress: () => props.onViewChange('list') },
                            {
                              text: 'By distance',
                              onPress: () => {
                                props.onSortChange('distance');
                                props.onViewChange('nearby');
                              },
                            },
                            {
                              text: 'Recently used',
                              onPress: () => {
                                props.onSortChange('recent');
                                props.onViewChange('nearby');
                              },
                            },
                          ]),
                      },
                      ...(props.onMySites
                        ? [{ text: 'My dive sites', onPress: props.onMySites }]
                        : [{ text: 'Cancel', style: 'cancel' as const }]),
                      { text: 'Use my location', onPress: props.onLocate },
                    ]),
                  )
                : null}
            </View>
          ),
        }),
  };
  return <Stack.Screen options={options} />;
}
