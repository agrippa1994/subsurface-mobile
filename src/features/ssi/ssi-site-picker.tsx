// AI-generated (Claude)
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import type { SsiSite } from '@/models/ssi/sites';
import type { SitePosition } from '@/models/ssi/site-browse';
import { setSsiPickerSession } from './ssi-site-picker-session';

export function SsiSitePicker(props: {
  visible: boolean;
  position: SitePosition | null;
  onSelect: (site: SsiSite) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    if (!props.visible) return;
    setSsiPickerSession({
      position: latest.current.position,
      onSelect: (site) => latest.current.onSelect(site),
      onClose: () => latest.current.onClose(),
    });
    router.push('/ssi-site-picker');
    return () => setSsiPickerSession(null);
  }, [props.visible, router]);
  return null;
}
