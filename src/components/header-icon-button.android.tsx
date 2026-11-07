// AI-generated (Claude)
// An icon button for an Android top app bar, drawn by Compose.
import { Host } from '@/components/material/host';
import { IconButton } from '@expo/ui/jetpack-compose';

import { M3Icon } from '@/components/material/icon';
import type { SFSymbol } from '@/components/symbol';

export function HeaderIconButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: SFSymbol;
  onPress: () => void;
}) {
  return (
    <Host matchContents>
      <IconButton onClick={onPress}>
        <M3Icon symbol={icon} label={label} />
      </IconButton>
    </Host>
  );
}
