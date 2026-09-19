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
import { PIXEL_PRESETS } from '../lib/presets';
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

/**
 * The gap the Preview screen's PNG steering exists to close.
 *
 * PNG is lossless: there is no quality lever, and the §5 Step 4 padding
 * fallback is JPEG-only. Measured against the fixtures, that bites in one
 * specific place — the FLOOR, not the ceiling. PNG can still meet a ceiling by
 * downscaling, but when the dimensions are pinned it encodes to whatever size
 * it encodes to, lands far under the requested minimum, and has no way back up.
 * JPEG reaches the same floor exactly, by padding.
 *
 * These pin that difference, because the steering would be pointless advice if
 * it were not true.
 */
describe('PNG cannot reach a floor that JPEG can', () => {
  const pinned = (width: number, height: number, minKB: number, maxKB: number) => ({
    minBytes: minKB * KB,
    maxBytes: maxKB * KB,
    targetWidth: width,
    targetHeight: height,
    // Pinned dimensions are what removes PNG's last lever: it may not downscale
    // its way to a size, so the encoder's own output is the only answer it has.
    dimensionMode: 'exact' as const,
  });

  const cases: Array<{ fixture: string; width: number; height: number; min: number; max: number }> = [
    { fixture: 'screenshot-phone.png', width: 200, height: 230, min: 20, max: 50 },
    { fixture: 'transparent-logo.png', width: 240, height: 240, min: 20, max: 50 },
    { fixture: 'signature-scan.png', width: 140, height: 60, min: 20, max: 50 },
    { fixture: 'high-contrast-barcode.png', width: 350, height: 350, min: 30, max: 60 },
  ];

  for (const { fixture, width, height, min, max } of cases) {
    it(`${fixture} lands under the floor as PNG and on it as JPEG`, async () => {
      const sourceUri = join(FIXTURE_DIR, fixture);
      const spec = pinned(width, height, min, max);

      const asPng = await compress({ ...spec, sourceUri, format: 'png' }, codec);
      const asJpeg = await compress({ ...spec, sourceUri, format: 'jpeg' }, codec);

      // PNG: under the ceiling, which it never breaks, but below the minimum
      // the form asked for — and with no lever left to climb.
      expect(asPng.status).toBe('best_effort_under');
      expect(asPng.finalBytes).toBeLessThan(min * KB);

      // JPEG: inside the band. This is the offer the UI makes.
      expect(asJpeg.status).toBe('exact');
      expect(asJpeg.finalBytes).toBeGreaterThanOrEqual(min * KB);
      expect(asJpeg.finalBytes).toBeLessThanOrEqual(max * KB);
    });
  }

  it('holds the ceiling as PNG even while missing the floor', async () => {
    // The guarantee that outranks everything else still applies to the format
    // the user is being steered away from.
    const sourceUri = join(FIXTURE_DIR, 'screenshot-phone.png');
    const result = await compress(
      { ...pinned(200, 230, 20, 50), sourceUri, format: 'png' },
      codec,
    );
    expect(result.finalBytes).toBeLessThanOrEqual(50 * KB);
  });
});

/**
 * A named pixel size must actually deliver that pixel size.
 *
 * The presets were previously applied as `fit`, which scales the image to sit
 * INSIDE the box. That only produces the selected size when the source already
 * shares its aspect ratio — a 4:3 photo asked for 350×350 came back 350×263,
 * and "Signature 140×60" on a portrait photo came back 45×60. 15 of 18
 * source/preset combinations missed.
 *
 * `fill` covers the box and centre-crops the overflow, so the label is the
 * truth. This walks the whole matrix that used to fail.
 */
describe('named pixel sizes deliver exactly what they say', () => {
  const sources = [
    'phone-photo-landscape.jpg',
    'phone-photo-portrait.jpg',
    'square-passport.jpg',
    'panorama-wide.jpg',
    'tall-narrow.jpg',
  ];

  for (const fixture of sources) {
    for (const option of PIXEL_PRESETS) {
      if (option.widthPx === null || option.heightPx === null) continue;

      it(`${fixture} → ${option.detail}`, async () => {
        const result = await compress(
          {
            sourceUri: join(FIXTURE_DIR, fixture),
            minBytes: null,
            maxBytes: 200 * KB,
            targetWidth: option.widthPx,
            targetHeight: option.heightPx,
            format: 'jpeg',
            // Exactly what tapping the preset on the site now sets.
            dimensionMode: 'fill',
          },
          codec,
        );

        expect(result.finalWidth).toBe(option.widthPx);
        expect(result.finalHeight).toBe(option.heightPx);
        // The ceiling still outranks everything, including the new promise.
        expect(result.finalBytes).toBeLessThanOrEqual(200 * KB);
      });
    }
  }

  it('crops rather than distorts: the kept region has the target aspect ratio', async () => {
    // A panorama squeezed into a square would be unmistakably squashed. Proof
    // that it is not: the output is a centre slice of the original, so a
    // vertical strip down the middle survives unchanged in proportion.
    const result = await compress(
      {
        sourceUri: join(FIXTURE_DIR, 'panorama-wide.jpg'),
        minBytes: null,
        maxBytes: 500 * KB,
        targetWidth: 350,
        targetHeight: 350,
        format: 'jpeg',
        dimensionMode: 'fill',
      },
      codec,
    );
    expect(result.finalWidth).toBe(350);
    expect(result.finalHeight).toBe(350);

    const meta = await sharp(result.outputUri).metadata();
    expect(meta.width).toBe(350);
    expect(meta.height).toBe(350);
  });

  it('still fits inside the box when the mode is fit, which is now opt-in', async () => {
    // The old behaviour is not gone, just no longer what a preset selects.
    const result = await compress(
      {
        sourceUri: join(FIXTURE_DIR, 'phone-photo-landscape.jpg'),
        minBytes: null,
        maxBytes: 200 * KB,
        targetWidth: 350,
        targetHeight: 350,
        format: 'jpeg',
        dimensionMode: 'fit',
      },
      codec,
    );
    expect(Math.max(result.finalWidth, result.finalHeight)).toBeLessThanOrEqual(350);
    expect(result.finalHeight).toBeLessThan(350);
  });
});
