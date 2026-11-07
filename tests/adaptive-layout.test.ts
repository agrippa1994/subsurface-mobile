// AI-generated (Claude)
import { describe, expect, it } from 'vitest';

import {
  detailIsBusy,
  isTabletSize,
  openDiveId,
  sidebarWidth,
  splitsAt,
} from '@/models/adaptive-layout';
import type { DiveSite } from '@/models';
import { searchSites } from '@/models/site-edit';
import { detentAfterDrag, nextDetent, sheetPositions } from '@/models/sheet-detents';

describe('tablet and split decisions', () => {
  it('tells a phone from a tablet whichever way it is held', () => {
    expect(isTabletSize(440, 956)).toBe(false);
    expect(isTabletSize(956, 440)).toBe(false);
    expect(isTabletSize(744, 1133)).toBe(true);
    expect(isTabletSize(1133, 744)).toBe(true);
  });

  it('splits only on a tablet, and only in a wide enough window', () => {
    expect(splitsAt(false, 956)).toBe(false);
    expect(splitsAt(true, 500)).toBe(false);
    expect(splitsAt(true, 744)).toBe(true);
  });

  it('keeps the sidebar readable without letting it take over', () => {
    expect(sidebarWidth(744)).toBe(340);
    expect(sidebarWidth(1000)).toBe(360);
    expect(sidebarWidth(1366)).toBe(400);
  });
});

describe('what the sidebar reads from the route', () => {
  it('marks the dive shown directly in the detail', () => {
    expect(openDiveId('/dives/42')).toBe(42);
    expect(openDiveId('/dives')).toBeNull();
    expect(openDiveId('/dives/edit/42')).toBeNull();
    expect(openDiveId('/dives/trip/42')).toBeNull();
    expect(openDiveId('/sites/dive/42')).toBeNull();
  });

  it('stays out of the way of work in progress', () => {
    expect(detailIsBusy('/dives/edit/42')).toBe(true);
    expect(detailIsBusy('/dives/ssi/42')).toBe(true);
    expect(detailIsBusy('/dives/trip/edit/7')).toBe(true);
    expect(detailIsBusy('/dives/download')).toBe(true);
    expect(detailIsBusy('/dives/42')).toBe(false);
    expect(detailIsBusy('/dives/trip/7')).toBe(false);
    expect(detailIsBusy('/dives')).toBe(false);
  });
});

describe('map sheet stops', () => {
  const positions = sheetPositions({
    sheetHeight: 700,
    areaHeight: 800,
    headerHeight: 80,
    bottomInset: 80,
  });

  it('places the stops from open down to just the header', () => {
    expect(positions).toEqual({ large: 0, medium: 260, small: 540 });
  });

  it('never lets the medium stop fall below the small one', () => {
    const short = sheetPositions({
      sheetHeight: 200,
      areaHeight: 300,
      headerHeight: 80,
      bottomInset: 80,
    });
    expect(short.medium).toBeLessThanOrEqual(short.small);
    expect(short.medium).toBeGreaterThanOrEqual(0);
  });

  it('lands on the nearest stop when released slowly', () => {
    expect(detentAfterDrag(40, 0, positions)).toBe('large');
    expect(detentAfterDrag(300, 0, positions)).toBe('medium');
    expect(detentAfterDrag(500, 0, positions)).toBe('small');
  });

  it('lets a flick carry past the nearest stop', () => {
    expect(detentAfterDrag(300, 2000, positions)).toBe('small');
    expect(detentAfterDrag(300, -2000, positions)).toBe('large');
  });

  it('cycles from the grabber without getting stuck at the top', () => {
    expect(nextDetent('small')).toBe('medium');
    expect(nextDetent('medium')).toBe('large');
    expect(nextDetent('large')).toBe('medium');
  });
});

describe('searching sites', () => {
  const sites = [{ name: 'Blue Hole' }, { name: 'Wreck of the Thistlegorm' }] as DiveSite[];

  it('matches any part of the name, ignoring case and spaces around it', () => {
    expect(searchSites(sites, ' thistle ')).toEqual([sites[1]]);
  });

  it('keeps everything for an empty query', () => {
    expect(searchSites(sites, '  ')).toEqual(sites);
  });
});
