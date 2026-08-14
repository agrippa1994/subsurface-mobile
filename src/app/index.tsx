// AI-generated (Claude)
// The app opens on the dive list. Kept as a redirect rather than making the
// list the index route, so the Dives tab owns a stack of its own and a dive can
// be pushed onto it without leaving the tab.
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/dives" />;
}
