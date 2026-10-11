// AI-generated (Claude)
// SymbolView that takes the SF Symbol name the screens are written against and
// renders its Material Symbols counterpart on Android.
//
// expo-symbols draws SF Symbols only on iOS; on Android it needs a Material
// Symbols name, and without one it shows nothing. Rather than spell both names
// out at every call site, the screens keep using SF names and this table
// supplies the Android one. A name missing here falls back to `fallback`.

import { SymbolView as ExpoSymbolView, type SymbolViewProps as ExpoSymbolViewProps } from 'expo-symbols';

// Both name types, taken from expo-symbols' own props rather than its
// transitive dependency and internal build paths.
type SymbolName = ExpoSymbolViewProps['name'];
export type SFSymbol = Exclude<SymbolName, object>;
type AndroidSymbol = NonNullable<Extract<SymbolName, object>['android']>;

/** SF Symbol -> Material Symbol, for every symbol the app draws. */
export const MATERIAL_SYMBOLS: Partial<Record<SFSymbol, AndroidSymbol>> = {
  'arrow.down.to.line': 'vertical_align_bottom',
  'chart.bar': 'bar_chart',
  'checkmark.circle.fill': 'check_circle',
  'checkmark.icloud': 'cloud_done',
  'chevron.right': 'chevron_right',
  clock: 'schedule',
  'clock.arrow.circlepath': 'history',
  'cylinder.fill': 'propane_tank',
  'exclamationmark.triangle': 'warning',
  gearshape: 'settings',
  'icloud.and.arrow.up': 'cloud_upload',
  'icloud.slash': 'cloud_off',
  'list.bullet': 'format_list_bulleted',
  mappin: 'location_on',
  'mappin.and.ellipse': 'location_on',
  'mappin.slash': 'location_off',
  'person.2.fill': 'group',
  'person.crop.circle.badge.questionmark': 'person_search',
  'person.fill.checkmark': 'how_to_reg',
  plus: 'add',
  'questionmark.circle': 'help',
  'scalemass.fill': 'fitness_center',
  'square.and.arrow.up': 'share',
  star: 'star_outline',
  'star.fill': 'star',
  'thermometer.medium': 'thermostat',
  'tshirt.fill': 'checkroom',
  'water.waves': 'waves',
  'wrench.and.screwdriver': 'build',
};

/** The Material Symbol drawn for an SF Symbol on Android, if there is one. */
export function materialSymbol(name: SFSymbol): AndroidSymbol | undefined {
  return MATERIAL_SYMBOLS[name];
}

export type SymbolViewProps = Omit<ExpoSymbolViewProps, 'name'> & { name: SFSymbol };

export function SymbolView({ name, ...props }: SymbolViewProps) {
  return <ExpoSymbolView name={{ ios: name, android: materialSymbol(name) }} {...props} />;
}
