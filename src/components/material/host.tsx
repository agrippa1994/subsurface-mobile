// AI-generated (Claude)
// The root of a Compose tree. It is told the appearance rather than left to find it:
// the activity handles a change of night mode itself, so a Host left alone keeps the
// palette it started with while React Native around it follows the system.
import { Host as ExpoHost, type UniversalHostProps } from '@expo/ui';

import { useColorScheme } from '@/hooks/use-color-scheme';

export function Host(props: UniversalHostProps) {
  const colorScheme = useColorScheme();
  return <ExpoHost colorScheme={colorScheme ?? undefined} {...props} />;
}
