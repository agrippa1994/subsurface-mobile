// AI-generated (Claude)
import { Stack } from 'expo-router';
import type {
  NativeStackHeaderItem,
  NativeStackHeaderItemMenuAction,
  NativeStackHeaderItemMenuSubmenu,
  NativeStackNavigationOptions,
} from 'expo-router/native-stack';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { HeaderIconButton } from '@/components/header-icon-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

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
          section(t('ssiBrowser.show'), [
            action(t('ui.myDiveSites'), () => props.onMySites?.()),
            action(t('sitesScreen.ssiSites'), () => {}, true),
          ]),
        ]
      : []),
    ...(props.view === 'list'
      ? [
          section(t('ui.sortBy'), [
            action(t('ui.name'), () => props.onSortChange('name'), props.sort === 'name'),
            action(t('ui.nearest'), () => props.onSortChange('nearest'), props.sort === 'nearest'),
            action(t('ui.recentlyUsed'), () => props.onSortChange('recent'), props.sort === 'recent'),
          ]),
        ]
      : []),
  ];
  const right: NativeStackHeaderItem[] = [];
  if (props.mapsAvailable)
    right.push({
      type: 'button',
      label: props.view === 'map' ? t('ssiBrowser.showList') : t('ssiBrowser.showMap'),
      icon: { type: 'sfSymbol', name: props.view === 'map' ? 'list.bullet' : 'map' },
      onPress: () => props.onViewChange(props.view === 'map' ? 'list' : 'map'),
    });
  right.push({
    type: 'button',
    label: props.view === 'map' ? t('ui.goToMyLocation') : t('ssiBrowser.sortNearest'),
    icon: { type: 'sfSymbol', name: props.locating ? 'location.fill' : 'location' },
    onPress: props.onLocate,
  });
  if (items.length)
    right.push({
      type: 'menu',
      label: t('sitesScreen.options'),
      icon: { type: 'sfSymbol', name: 'line.3.horizontal.decrease' },
      menu: { items },
    });
  const left: NativeStackHeaderItem[] = [];
  if (props.onBack)
    left.push({
      type: 'button',
      label: t('ssiBrowser.backToSites'),
      icon: { type: 'sfSymbol', name: 'chevron.left' },
      onPress: () => props.onBack?.(),
    });
  if (props.onClose)
    left.push({ type: 'button', label: t('ui.cancel'), onPress: () => props.onClose?.() });
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
    // Bar items float over the map on iOS 26; Android's header is opaque.
    headerTransparent: Platform.OS === 'ios' && props.view === 'map',
    headerSearchBarOptions: {
      placeholder: t('ssiBrowser.search'),
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
              {props.onBack ? fallbackButton(t('common.back'), props.onBack) : null}
              {props.onClose ? fallbackButton(t('common.cancel'), props.onClose) : null}
            </View>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {props.mapsAvailable && props.view === 'map' ? (
                <HeaderIconButton
                  label={t('ui.goToMyLocation')}
                  icon={props.locating ? 'location.fill' : 'location'}
                  onPress={props.onLocate}
                />
              ) : null}
              {props.mapsAvailable ? (
                <HeaderIconButton
                  label={props.view === 'map' ? t('ssiBrowser.showList') : t('ssiBrowser.showMap')}
                  icon={props.view === 'map' ? 'list.bullet' : 'map'}
                  onPress={() => props.onViewChange(props.view === 'map' ? 'list' : 'map')}
                />
              ) : null}
              {fallbackButton(t('ui.options'), () =>
                Alert.alert(t('sitesScreen.options'), undefined, [
                  {
                    text: t('ui.sortBy'),
                    onPress: () =>
                      Alert.alert(t('ui.sortBy'), undefined, [
                        { text: t('ui.name'), onPress: () => props.onSortChange('name') },
                        { text: t('ui.nearest'), onPress: () => props.onSortChange('nearest') },
                        { text: t('ui.recentlyUsed'), onPress: () => props.onSortChange('recent') },
                      ]),
                  },
                  ...(props.onMySites ? [{ text: t('ui.myDiveSites'), onPress: props.onMySites }] : []),
                  { text: t('ui.cancel'), style: 'cancel' as const },
                ]),
              )}
            </View>
          ),
        }),
  };
  return <Stack.Screen options={options} />;
}
