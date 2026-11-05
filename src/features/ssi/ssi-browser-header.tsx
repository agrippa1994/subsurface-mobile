// AI-generated (Claude)
import { Stack } from 'expo-router';
import type {
  NativeStackHeaderItem,
  NativeStackHeaderItemMenuAction,
  NativeStackHeaderItemMenuSubmenu,
  NativeStackNavigationOptions,
} from 'expo-router/native-stack';
import { useEffect, useRef } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import type { SearchBarCommands } from 'react-native-screens';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SsiBrowserView = 'map' | 'list';
export type SsiSiteSort = 'name' | 'nearest' | 'recent';
export type SsiBrowserHeaderProps = {
  title: string;
  view: SsiBrowserView;
  sort: SsiSiteSort;
  onViewChange: (view: SsiBrowserView) => void;
  onSortChange: (sort: SsiSiteSort) => void;
  query: string;
  onSearch: (text: string) => void;
  onLocate: () => void;
  locating: boolean;
  onBack?: () => void;
  onClose?: () => void;
  onMySites?: () => void;
  onSelect?: () => void;
  showingDetail: boolean;
  mapsAvailable: boolean;
};

// Native bar items use the same UIKit rendering as Stack.Toolbar elsewhere.
// Both the Sites tab and the modal picker use this shared header configuration.
export function SsiBrowserHeader(props: SsiBrowserHeaderProps) {
  const theme = useTheme();
  // The details screen has no search bar; the one that comes back starts empty
  // while its query still filters the sites.
  const searchBar = useRef<SearchBarCommands>(null);
  const { query, showingDetail } = props;
  useEffect(() => {
    if (showingDetail || !query) return;
    const frame = requestAnimationFrame(() => searchBar.current?.setText(query));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the bar returns
  }, [showingDetail]);
  const action = (
    label: string,
    onPress: () => void,
    selected = false,
  ): NativeStackHeaderItemMenuAction => ({
    type: 'action',
    label,
    onPress,
    // UIKit drops the checkmark state when a tap replaces the open menu, so the
    // selection is drawn as the item's icon.
    icon: selected ? { type: 'sfSymbol', name: 'checkmark' } : undefined,
  });
  // One question per section: which sites, and in what order. Order only means
  // something for a list, so the map does not offer it. Finding the user is the
  // location button's job rather than a menu entry.
  const section = (
    label: string,
    items: NativeStackHeaderItemMenuAction[],
  ): NativeStackHeaderItemMenuSubmenu => ({
    type: 'submenu',
    label,
    inline: true,
    multiselectable: true,
    items,
  });
  const items: NativeStackHeaderItemMenuSubmenu[] = [
    ...(props.onMySites
      ? [
          section('Show', [
            action('My dive sites', () => props.onMySites?.()),
            action('SSI dive sites', () => {}, true),
          ]),
        ]
      : []),
    ...(props.view === 'list'
      ? [
          section('Sort by', [
            action('Name', () => props.onSortChange('name'), props.sort === 'name'),
            action('Nearest', () => props.onSortChange('nearest'), props.sort === 'nearest'),
            action('Recently used', () => props.onSortChange('recent'), props.sort === 'recent'),
          ]),
        ]
      : []),
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
  if (!props.showingDetail) {
    if (props.mapsAvailable)
      right.push({
        type: 'button',
        label: props.view === 'map' ? 'Show as list' : 'Show on map',
        icon: { type: 'sfSymbol', name: props.view === 'map' ? 'list.bullet' : 'map' },
        onPress: () => props.onViewChange(props.view === 'map' ? 'list' : 'map'),
      });
    right.push({
      type: 'button',
      label: props.view === 'map' ? 'Go to my location' : 'Sort by nearest to me',
      icon: { type: 'sfSymbol', name: props.locating ? 'location.fill' : 'location' },
      onPress: props.onLocate,
    });
    if (items.length)
      right.push({
        type: 'menu',
        label: 'Site options',
        icon: { type: 'sfSymbol', name: 'line.3.horizontal.decrease' },
        menu: { items },
      });
  }
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
          ref: searchBar,
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
              {!props.showingDetail
                ? fallbackButton('Options', () =>
                    Alert.alert('Site options', undefined, [
                      {
                        text: 'Sort by',
                        onPress: () =>
                          Alert.alert('Sort by', undefined, [
                            { text: 'Name', onPress: () => props.onSortChange('name') },
                            { text: 'Nearest', onPress: () => props.onSortChange('nearest') },
                            { text: 'Recently used', onPress: () => props.onSortChange('recent') },
                          ]),
                      },
                      ...(props.onMySites
                        ? [{ text: 'My dive sites', onPress: props.onMySites }]
                        : []),
                      { text: 'Cancel', style: 'cancel' as const },
                    ]),
                  )
                : null}
            </View>
          ),
        }),
  };
  return <Stack.Screen options={options} />;
}
