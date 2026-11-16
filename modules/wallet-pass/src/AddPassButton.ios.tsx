// AI-generated (Claude)
// Apple's own "Add to Apple Wallet" button (PKAddPassButton). Its size is set
// here: the native button has an intrinsic height Yoga does not see.
import { requireNativeView } from 'expo';
import type { ViewProps } from 'react-native';

import type { AddPassButtonProps } from './AddPassButton';

export type { AddPassButtonProps } from './AddPassButton';

type NativeProps = ViewProps & { dark?: boolean; onPress?: () => void };

const NativeButton = requireNativeView<NativeProps>('WalletPass');

export function AddPassButton({ onPress, dark = false, style }: AddPassButtonProps) {
  return (
    <NativeButton
      dark={dark}
      onPress={onPress}
      accessibilityRole="button"
      style={[{ height: 48, alignSelf: 'stretch' }, style]}
    />
  );
}
