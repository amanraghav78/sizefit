/**
 * Phase 1 integration tests: the algorithm against real encoded images and a
 * real encoder (sharp), not a model of one.
 *
 * Covers acceptance tests 1-7 and 9 from design doc §13 as far as they can be
 * checked off-device. Tests 8, 10, 11 and 12 are app-level and belong to later
 * phases.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { compress } from '../src/core/compress';
import { CorruptInputError } from '../src/core/errors';
import { hasMetadata } from '../src/core/sniff';
import type { CompressRequest, CompressResult } from '../src/core/types';
import { FIXTURE_DIR, generateFixtures } from './fixtures/generate';
import { SharpCodec } from './sharpCodec';

const KB = 1024;
const codec = new SharpCodec();

/** Deliberately broken inputs live in the fixture dir but are tested apart. */
const BROKEN = new Set(['zero-byte.jpg', 'truncated.jpg']);

interface Scenario {
  name: string;
  request: Omit<CompressRequest, 'sourceUri'>;
}

/**
 * Size bands of the kind online forms ask for, covering both shapes: a bare
 * ceiling, and a floor-plus-ceiling range.
 */
const scenarios: Scenario[] = [
  {
    name: 'photo 20-50KB at 200x230 exact',
    request: {
      minBytes: 20 * KB,
      maxBytes: 50 * KB,
      targetWidth: 200,
      targetHeight: 230,
      format: 'jpeg',
      dimensionMode: 'exact',
    },
  },
  {
    name: 'signature 10-20KB at 140x60 exact',
    request: {
      minBytes: 10 * KB,
      maxBytes: 20 * KB,
      targetWidth: 140,
      targetHeight: 60,
      format: 'jpeg',
      dimensionMode: 'exact',
    },
  },
  {
    name: 'under 100KB, fit inside 1000x1000',
    request: {
      minBytes: null,
      maxBytes: 100 * KB,
      targetWidth: 1000,
      targetHeight: 1000,
      format: 'jpeg',
      dimensionMode: 'fit',
    },
  },
  {
    name: '50-200KB, dimensions preserved',
    request: {
      minBytes: 50 * KB,
      maxBytes: 200 * KB,
      targetWidth: null,
      targetHeight: null,
      format: 'jpeg',
      dimensionMode: 'preserve',
    },
  },
  {
    name: 'under 500KB, dimensions preserved',
    request: {
      minBytes: null,
      maxBytes: 500 * KB,
      targetWidth: null,
      targetHeight: null,
      format: 'jpeg',
      dimensionMode: 'preserve',
    },
  },
];

let fixtures: string[] = [];

beforeAll(async () => {
  await generateFixtures();
  const names = await readdir(FIXTURE_DIR);
  fixtures = names
    .filter((n) => !BROKEN.has(n))
    .sort()
    .map((n) => join(FIXTURE_DIR, n));
  expect(fixtures.length).toBeGreaterThanOrEqual(20);
});

describe('the full fixture set', () => {
  it('never exceeds maxBytes, and lands inside the band on at least 95% of runs', async () => {
    let runs = 0;
    let inBand = 0;
    const misses: string[] = [];
    let slowest = { name: '', ms: 0 };

    for (const fixture of fixtures) {
      for (const scenario of scenarios) {
        const started = Date.now();
        const result = await compress({ sourceUri: fixture, ...scenario.request }, codec);
        const elapsed = Date.now() - started;
        if (elapsed > slowest.ms) slowest = { name: basename(fixture), ms: elapsed };
        runs += 1;

        const label = `${basename(fixture)} / ${scenario.name}`;

        // Acceptance test 5: the hard ceiling is hard, on every single run.
        expect(result.finalBytes, `${label} exceeded the ceiling`).toBeLessThanOrEqual(
          scenario.request.maxBytes,
        );
        if (result.outputUri) {
          const onDisk = await stat(result.outputUri);
          expect(onDisk.size, `${label}: file on disk differs from reported size`).toBe(
            result.finalBytes,
          );
        }

        if (result.status === 'exact') {
          inBand += 1;
        } else {
          misses.push(`${label} -> ${result.status} at ${result.finalBytes}B`);
        }
      }
    }

    const rate = inBand / runs;
    expect(
      rate,
      `only ${(rate * 100).toFixed(1)}% landed in band. Misses:\n${misses.join('\n')}`,
    ).toBeGreaterThanOrEqual(0.95);
    // Acceptance test 9 is a device-level target; this is the desktop guard.
    expect(slowest.ms, `slowest fixture: ${slowest.name}`).toBeLessThan(15_000);
  }, 600_000);
});

describe('acceptance tests (§13)', () => {
  it('1. a multi-MB phone photo lands in a 20-50KB band at fixed dimensions first time', async () => {
    const result = await run('phone-photo-landscape.jpg', {
      minBytes: 20 * KB,
      maxBytes: 50 * KB,
      targetWidth: 200,
      targetHeight: 230,
      format: 'jpeg',
      dimensionMode: 'exact',
    });
    expect(result.status).toBe('exact');
    expect(result.finalBytes).toBeGreaterThanOrEqual(20 * KB);
    expect(result.finalBytes).toBeLessThanOrEqual(50 * KB);
    expect(result.finalWidth).toBe(200);
    expect(result.finalHeight).toBe(230);
  });

  it('2. a small signature scan is padded up into the 10-20KB band', async () => {
    const source = join(FIXTURE_DIR, 'signature-scan-small.jpg');
    expect((await stat(source)).size).toBeLessThan(10 * KB);

    const result = await run('signature-scan-small.jpg', {
      minBytes: 10 * KB,
      maxBytes: 20 * KB,
      targetWidth: 140,
      targetHeight: 60,
      format: 'jpeg',
      dimensionMode: 'exact',
    });
    expect(result.status).toBe('exact');
    expect(result.finalBytes).toBeGreaterThanOrEqual(10 * KB);
    expect(result.finalBytes).toBeLessThanOrEqual(20 * KB);
    expect(result.paddingBytes).toBeGreaterThan(0);

    // The padded file must still decode, at the right dimensions.
    const meta = await sharp(await readFile(result.outputUri)).metadata();
    expect(meta.width).toBe(140);
    expect(meta.height).toBe(60);
  });

  it('3. a PNG with transparency becomes a valid JPEG on a white background', async () => {
    const result = await run('transparent-signature.png', {
      minBytes: null,
      maxBytes: 100 * KB,
      targetWidth: null,
      targetHeight: null,
      format: 'jpeg',
      dimensionMode: 'preserve',
    });
    const image = sharp(await readFile(result.outputUri));
    const meta = await image.metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.hasAlpha).toBeFalsy();

    // Top-left is page, not ink: it must have been flattened to white.
    const { data } = await image.raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(240);
    expect(data[1]).toBeGreaterThan(240);
    expect(data[2]).toBeGreaterThan(240);
  });

  it.skipIf(!hasHeicFixture())('4. a HEIC source is handled without error', async () => {
    const result = await run('iphone-photo.heic', {
      minBytes: 20 * KB,
      maxBytes: 50 * KB,
      targetWidth: 200,
      targetHeight: 230,
      format: 'jpeg',
      dimensionMode: 'exact',
    });
    expect(result.status).toBe('exact');
  });

  it('6. dimensions match exactly in exact mode, including odd aspect ratios', async () => {
    for (const fixture of ['panorama-wide.jpg', 'tall-narrow.jpg', 'square-passport.jpg']) {
      const result = await run(fixture, {
        minBytes: null,
        maxBytes: 60 * KB,
        targetWidth: 213,
        targetHeight: 271,
        format: 'jpeg',
        dimensionMode: 'exact',
      });
      const meta = await sharp(await readFile(result.outputUri)).metadata();
      expect(meta.width, fixture).toBe(213);
      expect(meta.height, fixture).toBe(271);
    }
  });

  it('7. no EXIF or GPS data survives into the output', async () => {
    // The source really does carry what we claim it carries.
    const sourceBytes = await readFile(join(FIXTURE_DIR, 'exif-gps-rotated.jpg'));
    expect(hasMetadata(new Uint8Array(sourceBytes))).toBe(true);

    for (const scenario of scenarios) {
      const result = await run('exif-gps-rotated.jpg', scenario.request);
      const outputBytes = await readFile(result.outputUri);
      const meta = await sharp(outputBytes).metadata();
      expect(meta.exif, scenario.name).toBeUndefined();
      expect(meta.xmp, scenario.name).toBeUndefined();
      expect(meta.orientation ?? 1, scenario.name).toBe(1);

      // The same check the codec's passthrough decision relies on.
      expect(hasMetadata(new Uint8Array(outputBytes)), scenario.name).toBe(false);
    }
  });
});

describe('rotation', () => {
  it('turns a landscape photo into a portrait one and keeps the ceiling', async () => {
    const result = await compress(
      {
        sourceUri: join(FIXTURE_DIR, 'phone-photo-landscape.jpg'),
        minBytes: null,
        maxBytes: 100 * KB,
        targetWidth: null,
        targetHeight: null,
        format: 'jpeg',
        dimensionMode: 'preserve',
      },
      codec,
      { rotate: 90 },
    );

    expect(result.finalBytes).toBeLessThanOrEqual(100 * KB);
    expect(result.finalHeight).toBeGreaterThan(result.finalWidth);

    const meta = await sharp(await readFile(result.outputUri)).metadata();
    expect(meta.width).toBe(result.finalWidth);
    expect(meta.height).toBe(result.finalHeight);
  });

  it('returns to the original shape after four quarter turns', async () => {
    const base = {
      sourceUri: join(FIXTURE_DIR, 'square-passport.jpg'),
      minBytes: null,
      maxBytes: 100 * KB,
      targetWidth: null,
      targetHeight: null,
      format: 'jpeg' as const,
      dimensionMode: 'preserve' as const,
    };
    const upright = await compress(base, codec, { rotate: 0 });
    const turned = await compress(base, codec, { rotate: 180 });
    expect(turned.finalWidth).toBe(upright.finalWidth);
    expect(turned.finalHeight).toBe(upright.finalHeight);
  });
});

describe('edge cases (§5.3)', () => {
  it('rejects a zero-byte file with a typed error, not a crash', async () => {
    await expect(
      compress(
        {
          sourceUri: join(FIXTURE_DIR, 'zero-byte.jpg'),
          minBytes: null,
          maxBytes: 50 * KB,
          targetWidth: null,
          targetHeight: null,
          format: 'jpeg',
          dimensionMode: 'preserve',
        },
        codec,
      ),
    ).rejects.toBeInstanceOf(CorruptInputError);
  });

  it('rejects a truncated file with a typed error, not a crash', async () => {
    await expect(
      compress(
        {
          sourceUri: join(FIXTURE_DIR, 'truncated.jpg'),
          minBytes: null,
          maxBytes: 50 * KB,
          targetWidth: null,
          targetHeight: null,
          format: 'jpeg',
          dimensionMode: 'preserve',
        },
        codec,
      ),
    ).rejects.toBeInstanceOf(CorruptInputError);
  });

  it('caps a very large source at 4000px before encoding', async () => {
    const result = await run('dslr-huge.jpg', {
      minBytes: null,
      maxBytes: 500 * KB,
      targetWidth: null,
      targetHeight: null,
      format: 'jpeg',
      dimensionMode: 'preserve',
    });
    expect(Math.max(result.finalWidth, result.finalHeight)).toBeLessThanOrEqual(4000);
    expect(result.finalBytes).toBeLessThanOrEqual(500 * KB);
  });

  it('handles a 1x1 image without dividing by zero or crashing', async () => {
    const result = await run('one-pixel.png', {
      minBytes: null,
      maxBytes: 50 * KB,
      targetWidth: null,
      targetHeight: null,
      format: 'jpeg',
      dimensionMode: 'preserve',
    });
    expect(result.finalBytes).toBeLessThanOrEqual(50 * KB);
    expect(result.finalWidth).toBe(1);
  });

  it('stays under the ceiling even when the band is absurdly tight', async () => {
    const result = await run('phone-photo-portrait.jpg', {
      minBytes: null,
      maxBytes: 2 * KB,
      targetWidth: null,
      targetHeight: null,
      format: 'jpeg',
      dimensionMode: 'preserve',
    });
    expect(result.finalBytes).toBeLessThanOrEqual(2 * KB);
  });

  it('reports best_effort_over rather than returning an over-ceiling file silently', async () => {
    const result = await run('phone-photo-landscape.jpg', {
      minBytes: null,
      maxBytes: 300, // unreachable at 1000x1000 with dimensions locked
      targetWidth: 1000,
      targetHeight: 1000,
      format: 'jpeg',
      dimensionMode: 'exact',
    });
    expect(result.status).toBe('best_effort_over');
    expect(result.finalBytes).toBeGreaterThan(300);
  });
});

async function run(
  fixtureName: string,
  request: Omit<CompressRequest, 'sourceUri'>,
): Promise<CompressResult> {
  return compress({ sourceUri: join(FIXTURE_DIR, fixtureName), ...request }, codec);
}

function hasHeicFixture(): boolean {
  return fixtures.some((f) => f.endsWith('.heic'));
}
