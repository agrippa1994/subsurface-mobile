// AI-generated (Claude)
// Stack of the Dives tab: the list, a dive pushed on top of it, and the editor
// pushed on top of that; a trip with its editor, and the sheet that picks one.
import { Stack } from 'expo-router';

export default function DivesLayout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true }}>
      <Stack.Screen name="index" options={{ title: 'Dives' }} />
      <Stack.Screen name="[id]" options={{ title: 'Dive', headerLargeTitle: false }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit dive', headerLargeTitle: false }} />
      <Stack.Screen name="ssi/[id]" options={{ title: 'Sync to SSI', headerLargeTitle: false }} />
      <Stack.Screen
        name="add"
        options={{ title: 'Add Dive', headerLargeTitle: false, presentation: 'modal' }}
      />
      <Stack.Screen name="download" options={{ title: 'Dive computer', headerLargeTitle: false }} />
      <Stack.Screen
        name="trip/[id]"
        options={{ title: 'Trip', headerLargeTitle: false, headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen
        name="trip/edit/[id]"
        options={{ title: 'Edit trip', headerLargeTitle: false }}
      />
      <Stack.Screen
        name="trip/pick"
        options={{
          title: 'Add to Trip',
          headerLargeTitle: false,
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.6, 1],
        }}
      />
    </Stack>
  );
}
