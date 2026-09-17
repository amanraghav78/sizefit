import { describe, expect, it } from 'vitest';
import {
  MAX_INDEX,
  MIN_INDEX,
  highestStopWithin,
  NO_MINIMUM_INDEX,
  SIZE_STOPS_KB,
  formatStop,
  indexToMinimum,
  indexToRatio,
  minimumToIndex,
  nearestStopIndex,
  ratioToIndex,
  stopToKB,
} from './sizeScale';

describe('size stops', () => {
  it('ascends without duplicates', () => {
    for (let i = 1; i < SIZE_STOPS_KB.length; i += 1) {
      expect(SIZE_STOPS_KB[i]!).toBeGreaterThan(SIZE_STOPS_KB[i - 1]!);
    }
  });

  it('includes the sizes forms actually ask for', () => {
    for (const kb of [10, 20, 50, 100, 200, 300, 500, 1024]) {
      expect(SIZE_STOPS_KB).toContain(kb);
    }
  });

  it('clamps out-of-range indices instead of returning undefined', () => {
    expect(stopToKB(-5)).toBe(SIZE_STOPS_KB[MIN_INDEX]);
    expect(stopToKB(999)).toBe(SIZE_STOPS_KB[MAX_INDEX]);
  });
});

describe('nearestStopIndex', () => {
  it('round-trips every stop exactly', () => {
    for (const [index, kb] of SIZE_STOPS_KB.entries()) {
      expect(nearestStopIndex(kb)).toBe(index);
    }
  });

  it('snaps a typed value to the closest stop', () => {
    expect(stopToKB(nearestStopIndex(48))).toBe(50);
    expect(stopToKB(nearestStopIndex(22))).toBe(20);
  });

  it('breaks ties downward, so a ceiling never grows on its own', () => {
    // 22.5 sits midway between 20 and 25.
    expect(stopToKB(nearestStopIndex(22.5))).toBe(20);
  });
});

describe('the no-minimum slot', () => {
  it('maps null to its own index and back', () => {
    expect(minimumToIndex(null)).toBe(NO_MINIMUM_INDEX);
    expect(indexToMinimum(NO_MINIMUM_INDEX)).toBeNull();
  });

  it('maps a real minimum through the stops', () => {
    expect(indexToMinimum(minimumToIndex(20))).toBe(20);
  });

  it('sits at the far left of the minimum track', () => {
    expect(indexToRatio(NO_MINIMUM_INDEX, true)).toBe(0);
    expect(indexToRatio(MAX_INDEX, true)).toBe(1);
  });
});

describe('ratio mapping', () => {
  it('round-trips indices through positions', () => {
    for (const index of [MIN_INDEX, 5, 12, MAX_INDEX]) {
      expect(ratioToIndex(indexToRatio(index, false), false)).toBe(index);
    }
  });

  it('clamps positions outside the track', () => {
    expect(ratioToIndex(-1, false)).toBe(MIN_INDEX);
    expect(ratioToIndex(2, false)).toBe(MAX_INDEX);
    expect(ratioToIndex(-1, true)).toBe(NO_MINIMUM_INDEX);
  });
});

describe('formatStop', () => {
  it('uses KB below a megabyte and MB above', () => {
    expect(formatStop(50)).toBe('50 KB');
    expect(formatStop(1024)).toBe('1 MB');
    expect(formatStop(1536)).toBe('1.5 MB');
    expect(formatStop(5120)).toBe('5 MB');
  });
});

describe('highestStopWithin', () => {
  it('never returns a stop bigger than the file itself', () => {
    for (const kb of [7, 23, 99, 480, 3000, 99999]) {
      expect(stopToKB(highestStopWithin(kb))).toBeLessThanOrEqual(kb);
    }
  });

  it('lands exactly on a file that is already a stop', () => {
    expect(stopToKB(highestStopWithin(50))).toBe(50);
    expect(stopToKB(highestStopWithin(1024))).toBe(1024);
  });

  it('picks the stop below for a size between two', () => {
    expect(stopToKB(highestStopWithin(70))).toBe(60);
  });

  it('falls back to the smallest stop for a file below the whole scale', () => {
    expect(highestStopWithin(1)).toBe(MIN_INDEX);
  });
});
