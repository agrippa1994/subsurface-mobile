// AI-generated (Claude)
// "Open in Subsurface" from Files, Mail or AirDrop.
//
// iOS hands the app a `file://` URL - a copy in the app's Inbox for a file sent
// by another app, or the file itself when it was opened in place. The URL
// arrives the same way a deep link does, either as the URL that launched the
// app or through the linking event while it is running, so both are handled.
//
// Anything that is not a file URL is a real deep link and is left to
// expo-router.

import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { useTransfer } from './use-transfer';

function isFileUrl(url: string): boolean {
  return url.startsWith('file://');
}

/**
 * Watches for incoming files and offers to import each one. Mounted once, at
 * the root of the app.
 */
export function useIncomingFiles(handle: (uri: string) => Promise<void>): void {
  // The launch URL is reported again on every remount, and iOS re-delivers the
  // same URL when the app is foregrounded from the share sheet; without this
  // the user would be asked about the same file twice.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const offer = (url: string | null) => {
      if (cancelled || url === null || !isFileUrl(url) || handled.current === url) {
        return;
      }
      handled.current = url;
      void handle(url);
    };

    void Linking.getInitialURL().then(offer);
    const subscription = Linking.addEventListener('url', (event) => offer(event.url));
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [handle]);
}

/** Convenience wrapper for the root layout: its own transfer hook, wired up. */
export function useIncomingFileImports(): void {
  const { handleIncoming } = useTransfer();
  const router = useRouter();

  // Expo Router sees the same incoming URL and tries to match it as a route.
  // A `file:///.../Inbox/TestDive.SDE` matches nothing, so the app is left
  // sitting on the "page could not be found" screen behind the import alert.
  // The dive list is where an import belongs anyway, so the app goes there -
  // once when the URL arrives, and once more after the file has been dealt
  // with, because the router may still be settling the failed match by then.
  const handle = useCallback(
    async (uri: string) => {
      router.replace('/dives');
      try {
        await handleIncoming(uri);
      } finally {
        router.replace('/dives');
      }
    },
    [handleIncoming, router]
  );

  useIncomingFiles(handle);
}
