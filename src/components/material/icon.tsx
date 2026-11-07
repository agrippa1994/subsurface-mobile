// AI-generated (Claude)
// A Material Symbol in a Compose tree. The screens name symbols the way the rest of
// the app does, by SF Symbol, through the same table expo-symbols uses on Android.
import { Icon } from '@expo/ui/jetpack-compose';
import type { ColorValue } from 'react-native';

import { materialSymbol, type SFSymbol } from '@/components/symbol';

import { ICON_ASSETS, type MaterialIconName } from './icon-assets';

/** Without `tint` it takes the content colour of what it sits in, as Compose icons do. */
export function M3Icon({
  name,
  symbol,
  size = 24,
  tint,
  label,
}: {
  /** A Material Symbol by name. */
  name?: MaterialIconName;
  /** Or the SF Symbol the screen knows it as. */
  symbol?: SFSymbol | string;
  size?: number;
  tint?: ColorValue;
  label?: string;
}) {
  const key = name ?? (symbol ? (materialSymbol(symbol as SFSymbol) as MaterialIconName) : undefined);
  const source = key ? ICON_ASSETS[key] : undefined;
  if (!source) {
    return null;
  }
  return (
    <Icon
      source={source}
      size={size}
      contentDescription={label}
      {...(tint === undefined ? {} : { tint })}
    />
  );
}
