// AI-generated (Claude)
// How the app adapts to the size of its window, as decisions a test can read.
//
// Two questions, deliberately kept apart. Whether this is a tablet is a fact about
// the device, and decides how orientation behaves: a phone turned sideways is a
// gesture, a tablet in landscape or a wide Stage Manager window is just how it is
// being used. Whether a screen splits into a list and a detail depends on the
// window, which on a tablet can be resized at any moment.

/** Android's own line between a phone and a tablet (sw600dp). */
const TABLET_MIN_SHORT_SIDE = 600;
/** Below this a list and a dive side by side would each be too narrow to read. */
const SPLIT_MIN_WIDTH = 700;
const SIDEBAR_SHARE = 0.36;
const SIDEBAR_MIN_WIDTH = 340;
const SIDEBAR_MAX_WIDTH = 400;

export function isTabletSize(screenWidth: number, screenHeight: number): boolean {
  return Math.min(screenWidth, screenHeight) >= TABLET_MIN_SHORT_SIDE;
}

export function splitsAt(tablet: boolean, windowWidth: number): boolean {
  return tablet && windowWidth >= SPLIT_MIN_WIDTH;
}

export function sidebarWidth(windowWidth: number): number {
  const share = Math.round(windowWidth * SIDEBAR_SHARE);
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, share));
}

/** The dive the Dives tab's detail shows directly, which is the one its list marks. */
export function openDiveId(pathname: string): number | null {
  const match = /^\/dives\/(\d+)$/.exec(pathname);
  return match ? Number(match[1]) : null;
}

/**
 * Whether the detail is in the middle of something the sidebar must not navigate
 * away from: picking another dive would throw away an edit, an upload or a download.
 */
export function detailIsBusy(pathname: string): boolean {
  return /^\/dives\/(.*\/)?(edit|ssi)\//.test(pathname) || pathname === '/dives/download';
}
