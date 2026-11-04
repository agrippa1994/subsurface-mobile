// AI-generated (Claude)
import { Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import type { SsiSite } from '@/models/ssi/sites';
import type { SitePosition } from '@/models/ssi/site-browse';
import { SsiSiteBrowser } from './ssi-site-browser';

export function SsiSitePicker({
  visible,
  position,
  onSelect,
  onClose,
}: {
  visible: boolean;
  position: SitePosition | null;
  onSelect: (site: SsiSite) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      {visible ? (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <SsiSiteBrowser position={position} onSelect={onSelect} onClose={onClose} />
        </SafeAreaView>
      ) : null}
    </Modal>
  );
}
