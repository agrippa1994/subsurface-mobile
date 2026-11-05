// AI-generated (Claude)
import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { HeaderAction } from '@/components/header-action';
import { StatusView } from '@/components/status-view';
import { SsiSiteBrowser } from '@/features/ssi/ssi-site-browser';
import { useSsiPickerSession } from '@/features/ssi/ssi-site-picker-session';

export default function SsiSitePickerScreen() {
  const session = useSsiPickerSession();
  const initial = useRef(session);
  const router = useRouter();
  useEffect(() => () => initial.current?.onClose(), []);
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Select dive site' }} />
      {session ? (
        <SsiSiteBrowser
          position={session.position}
          onOpenSite={(site) => router.push(`/ssi-site-picker/${site.id}`)}
          onSelect={(site) => {
            router.back();
            session.onSelect(site);
          }}
          onClose={() => {
            router.back();
            session.onClose();
          }}
        />
      ) : (
        <>
          <HeaderAction
            label="Cancel"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/dives'))}
          />
          <StatusView
            kind="empty"
            title="Choose a dive first"
            description="Open the SSI site selector from a dive."
          />
        </>
      )}
    </>
  );
}
