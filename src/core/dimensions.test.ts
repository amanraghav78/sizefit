import { describe, expect, it } from 'vitest';
import {
  MAX_INPUT_EDGE,
  MIN_SHORT_EDGE,
  clampToMaxEdge,
  downscaleRound,
  predictiveDownscale,
  resolveTargetDimensions,
  upscaleRound,
} from './dimensions';

describe('resolveTargetDimensions', () => {
  it('distorts to exactly W x H in exact mode', () => {
    const d = resolveTargetDimensions({
      source: { width: 3000, height: 4000 },
      targetWidth: 200,
      targetHeight: 230,
      mode: 'exact',
    });
    expect(d).toEqual({ width: 200, height: 230 });
  });

  it('derives the missing axis from the source aspect in exact mode', () => {
    const d = resolveTargetDimensions({
      source: { width: 1000, height: 500 },
      targetWidth: 300,
      targetHeight: null,
      mode: 'exact',
    });
    expect(d).toEqual({ width: 300, height: 150 });
  });

  it('fits inside the box without distorting in fit mode', () => {
    const d = resolveTargetDimensions({
      source: { width: 4000, height: 2000 },
      targetWidth: 600,
      targetHeight: 600,
      mode: 'fit',
    });
    expect(d).toEqual({ width: 600, height: 300 });
  });

  it('does not upscale in fit mode', () => {
    const d = resolveTargetDimensions({
      source: { width: 300, height: 200 },
      targetWidth: 600,
      targetHeight: 600,
      mode: 'fit',
    });
    expect(d).toEqual({ width: 300, height: 200 });
  });

  it('caps oversized sources at MAX_INPUT_EDGE in preserve mode', () => {
    const d = resolveTargetDimensions({
      source: { width: 8000, height: 6000 },
      targetWidth: null,
      targetHeight: null,
      mode: 'preserve',
    });
    expect(Math.max(d.width, d.height)).toBe(MAX_INPUT_EDGE);
    expect(d.height / d.width).toBeCloseTo(6000 / 8000, 2);
  });
});

describe('downscaleRound', () => {
  it('shrinks by 15% per round', () => {
    expect(downscaleRound({ width: 1000, height: 800 })).toEqual({ width: 850, height: 680 });
  });

  it('stops before crossing the minimum short edge', () => {
    expect(downscaleRound({ width: 300, height: 210 })).toBeNull();
    expect(MIN_SHORT_EDGE).toBe(200);
  });
});

describe('upscaleRound', () => {
  it('grows by 15% when unbounded', () => {
    expect(upscaleRound({ width: 400, height: 300 }, null)).toEqual({ width: 460, height: 345 });
  });

  it('never grows past the fit box', () => {
    expect(upscaleRound({ width: 590, height: 400 }, { width: 600, height: 600 })).toEqual({
      width: 600,
      height: 406,
    });
    expect(upscaleRound({ width: 600, height: 406 }, { width: 600, height: 600 })).toBeNull();
  });
});

describe('predictiveDownscale', () => {
  it('jumps straight to roughly the scale that fits the ceiling', () => {
    // 100KB at 2000x1500, ceiling 25KB: pixels must drop ~4x, edges ~2x.
    const next = predictiveDownscale({ width: 2000, height: 1500 }, 100_000, 25_000);
    expect(next).not.toBeNull();
    expect(next!.width).toBeGreaterThan(900);
    expect(next!.width).toBeLessThan(1000);
    expect(next!.height / next!.width).toBeCloseTo(0.75, 2);
  });

  it('never steps less than the 15% the spec mandates', () => {
    const next = predictiveDownscale({ width: 1000, height: 1000 }, 10_050, 10_000);
    expect(next).toEqual({ width: 850, height: 850 });
  });

  it('stops at the minimum short edge rather than overshooting past it', () => {
    const next = predictiveDownscale({ width: 800, height: 400 }, 1_000_000, 1_000);
    expect(next).toEqual({ width: 400, height: 200 });
    expect(predictiveDownscale(next!, 1_000_000, 1_000)).toBeNull();
  });
});

describe('clampToMaxEdge', () => {
  it('leaves small images alone', () => {
    const d = { width: 100, height: 50 };
    expect(clampToMaxEdge(d)).toBe(d);
  });
});
