// AI-generated (Claude)
// Stack of the Settings tab.
import { Stack } from 'expo-router';
import { STACK_OPTIONS } from '@/constants/navigation';
import { t } from '@/i18n';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={STACK_OPTIONS}>
      <Stack.Screen name="index" options={{ title: t('nav.settings') }} />
      <Stack.Screen name="ssi" options={{ title: t('nav.ssi'), headerLargeTitle: false }} />
      <Stack.Screen
        name="ssi-import"
        options={{ title: t('nav.addSsiDives'), headerLargeTitle: false }}
      />
      <Stack.Screen name="git" options={{ title: t('nav.gitSync'), headerLargeTitle: false }} />
      <Stack.Screen name="download" options={{ title: t('nav.diveComputer'), headerLargeTitle: false }} />
    </Stack>
  );
}
