// AI-generated (Claude)
// Stack of the Cards tab: the diver's SSI certification cards, and one card
// pushed on top to show around.
import { Stack } from 'expo-router';

import { STACK_OPTIONS } from '@/constants/navigation';
import { t } from '@/i18n';

export default function CardsLayout() {
  return (
    <Stack screenOptions={STACK_OPTIONS}>
      <Stack.Screen name="index" options={{ title: t('nav.cards') }} />
      <Stack.Screen name="[id]" options={{ title: t('nav.card'), headerLargeTitle: false }} />
    </Stack>
  );
}
