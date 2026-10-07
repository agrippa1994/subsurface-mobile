// AI-generated (Claude)
// The single query client.
//
// TanStack Query is used here for its cache-invalidation and pending/error
// model, not for async orchestration: the native core is synchronous, so every
// queryFn below returns a value rather than awaiting one. The defaults are
// therefore the opposite of the web ones - nothing refetches on its own,
// because the only thing that can change the data is a mutation we made.

import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // There is no network. The default 'online' mode consults onlineManager,
        // which in React Native without NetInfo wired up would pause every
        // query and leave the app on a loading screen forever.
        networkMode: 'always',
        // The module is the source of truth and it cannot change behind our
        // back, so data is never stale until a mutation says so.
        staleTime: Infinity,
        gcTime: Infinity,
        // A synchronous native throw is deterministic; retrying it just delays
        // the error the user needs to see.
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
      },
      mutations: {
        networkMode: 'always',
        retry: false,
      },
    },
  });
}

/**
 * The app's one client, created when this module is first imported rather than
 * inside a component. The cache must outlive any remount of the root layout:
 * the module holds a single divelog, so a second client would be a second view
 * of it that the mutations started from the old tree never invalidate. A file
 * opened from another app is the case that bit: the import alert outlived a
 * router reset, and opening the file left the list on dive ids the module no
 * longer had.
 */
export const queryClient = createQueryClient();
