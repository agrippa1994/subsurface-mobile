// AI-generated (Claude)
// The stops of the sheet over the Sites map. A position is how far the sheet is
// moved down from fully open, which is what it animates as a transform.

export type SheetDetent = 'small' | 'medium' | 'large';
export type SheetPositions = Record<SheetDetent, number>;

/** Share of the area the medium stop shows above the bottom inset. */
const MEDIUM_SHARE = 0.45;
/** How far a flick carries, in seconds of its velocity at release. */
const PROJECTION_SEC = 0.15;

export function sheetPositions({
  sheetHeight,
  areaHeight,
  headerHeight,
  bottomInset,
}: {
  /** The sheet's own height, fully open. */
  sheetHeight: number;
  /** The area the sheet lives in. */
  areaHeight: number;
  /** What stays in view at the small stop: the grabber and the search field. */
  headerHeight: number;
  /** What covers the bottom of the area: the tab bar, the home indicator. */
  bottomInset: number;
}): SheetPositions {
  const small = Math.max(0, sheetHeight - headerHeight - bottomInset);
  return {
    small,
    medium: Math.min(small, Math.max(0, sheetHeight - areaHeight * MEDIUM_SHARE - bottomInset)),
    large: 0,
  };
}

/** The stop a drag released at `position` lands on. Runs on the UI thread. */
export function detentAfterDrag(
  position: number,
  velocity: number,
  positions: SheetPositions,
): SheetDetent {
  'worklet';
  const projected = position + velocity * PROJECTION_SEC;
  const distance = (detent: SheetDetent) => Math.abs(positions[detent] - projected);
  let nearest: SheetDetent = 'small';
  if (distance('medium') < distance(nearest)) nearest = 'medium';
  if (distance('large') < distance(nearest)) nearest = 'large';
  return nearest;
}

/** Where tapping the grabber goes: up a stop, and from the top back to the middle. */
export function nextDetent(detent: SheetDetent): SheetDetent {
  return detent === 'small' ? 'medium' : detent === 'medium' ? 'large' : 'medium';
}
