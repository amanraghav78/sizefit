import { describe, expect, it } from 'vitest';
import { MAX_QUALITY_ITERATIONS, compress } from './compress';
import { MIN_SHORT_EDGE } from './dimensions';
import { CancelledError, CorruptInputError, InvalidRequestError } from './errors';
import { FakeCodec } from './testing/fakeCodec';
import type { CompressRequest } from './types';

const KB = 1024;

function request(overrides: Partial<CompressRequest> = {}): CompressRequest {
  return {
    sourceUri: 'fake://source.jpg',
    minBytes: 20 * KB,
    maxBytes: 50 * KB,
    targetWidth: null,
    targetHeight: null,
    format: 'jpeg',
    dimensionMode: 'preserve',
    ...overrides,
  };
}

describe('compress - the hard ceiling', () => {
  it('never returns a file above maxBytes when one can be produced', async () => {
    const codec = new FakeCodec();
    const result = await compress(request({ minBytes: null, maxBytes: 50 * KB }), codec);
    expect(result.status).toBe('exact');
    expect(result.finalBytes).toBeLessThanOrEqual(50 * KB);
  });

  it('holds the ceiling across a spread of targets and source sizes', async () => {
    const targets = [10, 20, 50, 100, 200, 500].map((kb) => kb * KB);
    const sources = [
      { width: 640, height: 480 },
      { width: 1200, height: 1600 },
      { width: 3000, height: 4000 },
      { width: 4032, height: 3024 },
    ];
    for (const maxBytes of targets) {
      for (const dims of sources) {
        const codec = new FakeCodec(dims);
        const result = await compress(
          request({ minBytes: null, maxBytes, dimensionMode: 'preserve' }),
          codec,
        );
        expect(
          result.finalBytes,
          `${dims.width}x${dims.height} -> ${maxBytes}B gave ${result.finalBytes}B`,
        ).toBeLessThanOrEqual(maxBytes);
      }
    }
  });

  it('flags best_effort_over instead of silently exceeding the ceiling', async () => {
    // Exact dimensions are a hard constraint, so no downscale rescue is allowed.
    const codec = new FakeCodec({ width: 4000, height: 4000 });
    const result = await compress(
      request({
        minBytes: null,
        maxBytes: 1 * KB,
        targetWidth: 4000,
        targetHeight: 4000,
        dimensionMode: 'exact',
      }),
      codec,
    );
    expect(result.status).toBe('best_effort_over');
    expect(result.finalBytes).toBeGreaterThan(1 * KB);
  });
});

describe('compress - landing inside the band', () => {
  it('lands a 4MB photo inside a 20-50KB band', async () => {
    const codec = new FakeCodec();
    const result = await compress(
      request({
        minBytes: 20 * KB,
        maxBytes: 50 * KB,
        targetWidth: 200,
        targetHeight: 230,
        dimensionMode: 'exact',
      }),
      codec,
    );
    expect(result.status).toBe('exact');
    expect(result.finalBytes).toBeGreaterThanOrEqual(20 * KB);
    expect(result.finalBytes).toBeLessThanOrEqual(50 * KB);
    expect(result.finalWidth).toBe(200);
    expect(result.finalHeight).toBe(230);
  });

  it('spends at most MAX_QUALITY_ITERATIONS encodes per dimension round', async () => {
    const codec = new FakeCodec();
    await compress(
      request({
        minBytes: 45 * KB,
        maxBytes: 50 * KB,
        targetWidth: 600,
        targetHeight: 800,
        dimensionMode: 'exact',
      }),
      codec,
    );
    expect(codec.renders.length).toBeLessThanOrEqual(MAX_QUALITY_ITERATIONS);
  });

  it('keeps every dimension round within the iteration budget, fallbacks included', async () => {
    const codec = new FakeCodec({ width: 4032, height: 3024 });
    await compress(request({ minBytes: 18 * KB, maxBytes: 20 * KB }), codec);
    const perRound = new Map<string, number>();
    for (const render of codec.renders) {
      const key = `${render.width}x${render.height}`;
      perRound.set(key, (perRound.get(key) ?? 0) + 1);
    }
    for (const [dims, count] of perRound) {
      expect(count, `${dims} used ${count} encodes`).toBeLessThanOrEqual(MAX_QUALITY_ITERATIONS);
    }
  });

  it('uses the soft floor to avoid needlessly poor quality when no floor is given', async () => {
    const codec = new FakeCodec();
    const result = await compress(request({ minBytes: null, maxBytes: 100 * KB }), codec);
    // A naive early exit would settle for whatever quality 50 produced.
    expect(result.finalBytes).toBeGreaterThan(70 * KB);
    expect(result.finalBytes).toBeLessThanOrEqual(100 * KB);
  });
});

describe('compress - dimension fallback (§5 Step 3)', () => {
  it('downscales when even quality 1 is over the ceiling', async () => {
    const codec = new FakeCodec({ width: 4000, height: 3000 });
    const result = await compress(
      request({ minBytes: null, maxBytes: 20 * KB, dimensionMode: 'preserve' }),
      codec,
    );
    expect(result.finalBytes).toBeLessThanOrEqual(20 * KB);
    expect(result.finalWidth).toBeLessThan(4000);
  });

  it('never downscales below the minimum short edge', async () => {
    const codec = new FakeCodec({ width: 900, height: 600 });
    const result = await compress(
      request({ minBytes: null, maxBytes: 300, dimensionMode: 'preserve' }),
      codec,
    );
    const shortEdge = Math.min(result.finalWidth, result.finalHeight);
    expect(shortEdge).toBeGreaterThanOrEqual(MIN_SHORT_EDGE);
  });

  it('refuses to change dimensions in exact mode', async () => {
    const codec = new FakeCodec({ width: 4000, height: 3000 });
    const result = await compress(
      request({
        minBytes: null,
        maxBytes: 5 * KB,
        targetWidth: 1000,
        targetHeight: 1000,
        dimensionMode: 'exact',
      }),
      codec,
    );
    expect(result.finalWidth).toBe(1000);
    expect(result.finalHeight).toBe(1000);
  });
});

describe('compress - floor fallback (§5 Step 4)', () => {
  it('pads a tiny signature scan up into the 10-20KB band', async () => {
    // A small, highly compressible scan: nowhere near 10KB even at quality 100.
    const codec = new FakeCodec({
      width: 300,
      height: 100,
      bytes: 8 * KB,
      bytesPerPixel: () => 0.05,
    });
    const result = await compress(
      request({
        minBytes: 10 * KB,
        maxBytes: 20 * KB,
        targetWidth: 300,
        targetHeight: 100,
        dimensionMode: 'exact',
      }),
      codec,
    );
    expect(result.status).toBe('exact');
    expect(result.finalBytes).toBeGreaterThanOrEqual(10 * KB);
    expect(result.finalBytes).toBeLessThanOrEqual(20 * KB);
    expect(result.paddingBytes).toBeGreaterThan(0);
  });

  it('prefers upscaling over padding when dimensions are not fixed', async () => {
    const codec = new FakeCodec({
      width: 400,
      height: 300,
      bytes: 9 * KB,
      bytesPerPixel: (q) => 0.02 + 0.05 * (q / 100),
    });
    const result = await compress(
      request({ minBytes: 12 * KB, maxBytes: 25 * KB, dimensionMode: 'preserve' }),
      codec,
    );
    expect(result.status).toBe('exact');
    expect(result.paddingBytes).toBe(0);
    expect(result.finalWidth).toBeGreaterThan(400);
  });

  it('reports best_effort_under when padding would breach the ceiling', async () => {
    // Lands 2 bytes short of a zero-width band. The smallest comment segment is
    // 4 bytes, so padding would overshoot the ceiling: report honestly instead.
    const codec = new FakeCodec({
      width: 300,
      height: 100,
      bytes: 11 * KB,
      bytesPerPixel: () => (10 * KB - 2) / 30_000,
    });
    const result = await compress(
      request({
        minBytes: 10 * KB,
        maxBytes: 10 * KB,
        targetWidth: 300,
        targetHeight: 100,
        dimensionMode: 'exact',
      }),
      codec,
    );
    expect(result.status).toBe('best_effort_under');
    expect(result.finalBytes).toBe(10 * KB - 2);
    expect(result.paddingBytes).toBe(0);
  });
});

describe('compress - passthrough (§5.3)', () => {
  it('returns the original untouched when it already satisfies everything', async () => {
    const codec = new FakeCodec({
      width: 600,
      height: 800,
      bytes: 30 * KB,
      format: 'jpeg',
      hasMetadata: false,
    });
    const result = await compress(
      request({ minBytes: 20 * KB, maxBytes: 50 * KB, dimensionMode: 'preserve' }),
      codec,
    );
    expect(result.passthrough).toBe(true);
    expect(result.iterations).toBe(0);
    expect(codec.renders).toHaveLength(0);
    expect(result.outputUri).toBe('fake://source.jpg');
  });

  it('re-encodes an in-band file that still carries metadata (GPS must go)', async () => {
    const codec = new FakeCodec({
      width: 600,
      height: 800,
      bytes: 30 * KB,
      format: 'jpeg',
      hasMetadata: true,
    });
    const result = await compress(
      request({ minBytes: 20 * KB, maxBytes: 50 * KB, dimensionMode: 'preserve' }),
      codec,
    );
    expect(result.passthrough).toBe(false);
    expect(codec.renders.length).toBeGreaterThan(0);
  });

  it('re-encodes a HEIC source even when its size already fits', async () => {
    const codec = new FakeCodec({
      width: 600,
      height: 800,
      bytes: 30 * KB,
      format: 'heic',
      hasMetadata: false,
    });
    const result = await compress(
      request({ minBytes: 20 * KB, maxBytes: 50 * KB, dimensionMode: 'preserve' }),
      codec,
    );
    expect(result.passthrough).toBe(false);
  });
});

describe('compress - very large input (§5.3)', () => {
  it('caps the working dimensions at 4000px before searching', async () => {
    const codec = new FakeCodec({ width: 8000, height: 6000, bytes: 25_000_000 });
    await compress(request({ minBytes: null, maxBytes: 200 * KB }), codec);
    for (const render of codec.renders) {
      expect(Math.max(render.width, render.height)).toBeLessThanOrEqual(4000);
    }
  });
});

describe('compress - PNG', () => {
  it('steers PNG size by dimensions, since quality is not a lever', async () => {
    const codec = new FakeCodec({ width: 1200, height: 900, pngBytesPerPixel: 1.2 });
    const result = await compress(
      request({ minBytes: null, maxBytes: 200 * KB, format: 'png', dimensionMode: 'preserve' }),
      codec,
    );
    expect(result.finalBytes).toBeLessThanOrEqual(200 * KB);
    expect(result.finalWidth).toBeLessThan(1200);
    for (const render of codec.renders) {
      expect(render.format).toBe('png');
    }
  });
});

describe('compress - rotation (§3 allows crop and rotate)', () => {
  it('passes the requested turn to every render', async () => {
    const codec = new FakeCodec({ width: 1000, height: 800 });
    await compress(request({ minBytes: null, maxBytes: 50 * KB }), codec, { rotate: 90 });
    expect(codec.renders.length).toBeGreaterThan(0);
    for (const render of codec.renders) {
      expect(render.rotate).toBe(90);
    }
  });

  it('swaps the axes for a quarter turn, so dimension rules see the rotated shape', async () => {
    const codec = new FakeCodec({ width: 1000, height: 800 });
    const result = await compress(
      request({ minBytes: null, maxBytes: 200 * KB, dimensionMode: 'preserve' }),
      codec,
      { rotate: 90 },
    );
    expect(result.finalWidth).toBe(800);
    expect(result.finalHeight).toBe(1000);
  });

  it('leaves the axes alone for a half turn', async () => {
    const codec = new FakeCodec({ width: 1000, height: 800 });
    const result = await compress(
      request({ minBytes: null, maxBytes: 200 * KB, dimensionMode: 'preserve' }),
      codec,
      { rotate: 180 },
    );
    expect(result.finalWidth).toBe(1000);
    expect(result.finalHeight).toBe(800);
  });

  it('fits the rotated shape into the requested box', async () => {
    const codec = new FakeCodec({ width: 2000, height: 1000 });
    const result = await compress(
      request({
        minBytes: null,
        maxBytes: 200 * KB,
        targetWidth: 600,
        targetHeight: 600,
        dimensionMode: 'fit',
      }),
      codec,
      { rotate: 90 },
    );
    // Rotated the image is 1000x2000, so height is the constrained edge.
    expect(result.finalHeight).toBe(600);
    expect(result.finalWidth).toBe(300);
  });

  it('never passes a rotated file through untouched', async () => {
    const codec = new FakeCodec({
      width: 600,
      height: 800,
      bytes: 30 * KB,
      format: 'jpeg',
      hasMetadata: false,
    });
    const result = await compress(
      request({ minBytes: 20 * KB, maxBytes: 50 * KB, dimensionMode: 'preserve' }),
      codec,
      { rotate: 90 },
    );
    expect(result.passthrough).toBe(false);
    expect(codec.renders.length).toBeGreaterThan(0);
  });
});

describe('compress - failure modes', () => {
  it('rejects a corrupt or zero-byte source with a typed error', async () => {
    const codec = new FakeCodec();
    await expect(compress(request({ sourceUri: 'corrupt://empty' }), codec)).rejects.toBeInstanceOf(
      CorruptInputError,
    );
  });

  it('rejects a floor above the ceiling', async () => {
    const codec = new FakeCodec();
    await expect(
      compress(request({ minBytes: 60 * KB, maxBytes: 50 * KB }), codec),
    ).rejects.toBeInstanceOf(InvalidRequestError);
  });

  it('rejects a non-positive ceiling', async () => {
    const codec = new FakeCodec();
    await expect(compress(request({ minBytes: null, maxBytes: 0 }), codec)).rejects.toBeInstanceOf(
      InvalidRequestError,
    );
  });

  it('cancels cleanly when the signal aborts mid-search', async () => {
    const codec = new FakeCodec();
    const controller = new AbortController();
    const originalRender = codec.render.bind(codec);
    let calls = 0;
    codec.render = async (req) => {
      calls += 1;
      if (calls === 2) controller.abort();
      return originalRender(req);
    };
    await expect(
      compress(request({ minBytes: 45 * KB, maxBytes: 50 * KB }), codec, {
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(CancelledError);
  });
});
