/**
 * Builds the fixture set for Phase 1 (design doc §12): real encoded image
 * files covering the input shapes the app will actually meet.
 *
 * Deterministic - a seeded PRNG, so fixture sizes do not drift between runs.
 * Run with `npm run fixtures`; the integration test regenerates them on demand.
 */
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'generated');

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Photo-like content: smooth gradients plus grain, so it compresses like one. */
function photoRaw(width: number, height: number, seed: number, grain = 28): Buffer {
  const random = rng(seed);
  const buf = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      const wave =
        Math.sin((x / width) * Math.PI * 3 + seed) * 60 +
        Math.cos((y / height) * Math.PI * 2) * 50;
      const base = 128 + wave;
      buf[i] = clamp(base + (random() - 0.5) * grain + 20);
      buf[i + 1] = clamp(base + (random() - 0.5) * grain);
      buf[i + 2] = clamp(base + (random() - 0.5) * grain - 25);
    }
  }
  return buf;
}

/** Flat UI-like content: large solid blocks, compresses far better than a photo. */
function screenshotRaw(width: number, height: number): Buffer {
  const buf = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    const band = Math.floor(y / 80) % 3;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      const inCard = x > 40 && x < width - 40 && y % 160 > 20 && y % 160 < 140;
      const v = inCard ? [250, 248, 244][band]! : [24, 28, 38][band]!;
      buf[i] = v;
      buf[i + 1] = v;
      buf[i + 2] = v;
    }
  }
  return buf;
}

/** White page with a few dark strokes: a scanned signature. */
function signatureRaw(width: number, height: number, seed: number): Buffer {
  const random = rng(seed);
  const buf = Buffer.alloc(width * height * 3, 0xff);
  let x = width * 0.08;
  let y = height * 0.6;
  while (x < width * 0.92) {
    x += 1 + random() * 2;
    y += (random() - 0.5) * 14;
    y = Math.min(height - 6, Math.max(6, y));
    for (let dy = -3; dy <= 3; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const px = Math.round(x) + dx;
        const py = Math.round(y) + dy;
        if (px < 0 || px >= width || py < 0 || py >= height) continue;
        const i = (py * width + px) * 3;
        buf[i] = 20;
        buf[i + 1] = 20;
        buf[i + 2] = 30;
      }
    }
  }
  return buf;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

interface FixtureSpec {
  name: string;
  build: () => Promise<Buffer>;
}

const specs: FixtureSpec[] = [
  {
    name: 'phone-photo-landscape.jpg',
    build: () =>
      sharp(photoRaw(4032, 3024, 1), { raw: { width: 4032, height: 3024, channels: 3 } })
        .jpeg({ quality: 92 })
        .toBuffer(),
  },
  {
    name: 'phone-photo-portrait.jpg',
    build: () =>
      sharp(photoRaw(3024, 4032, 2), { raw: { width: 3024, height: 4032, channels: 3 } })
        .jpeg({ quality: 92 })
        .toBuffer(),
  },
  {
    name: 'phone-photo-selfie.jpg',
    build: () =>
      sharp(photoRaw(2160, 3840, 3), { raw: { width: 2160, height: 3840, channels: 3 } })
        .jpeg({ quality: 88 })
        .toBuffer(),
  },
  {
    name: 'dslr-huge.jpg',
    build: () =>
      sharp(photoRaw(6000, 4000, 4, 90), { raw: { width: 6000, height: 4000, channels: 3 } })
        .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
        .toBuffer(),
  },
  {
    name: 'screenshot-phone.png',
    build: () =>
      sharp(screenshotRaw(1080, 2400), { raw: { width: 1080, height: 2400, channels: 3 } })
        .png()
        .toBuffer(),
  },
  {
    name: 'screenshot-phone.jpg',
    build: () =>
      sharp(screenshotRaw(1080, 2400), { raw: { width: 1080, height: 2400, channels: 3 } })
        .jpeg({ quality: 95 })
        .toBuffer(),
  },
  {
    name: 'signature-scan.jpg',
    build: () =>
      sharp(signatureRaw(1200, 400, 5), { raw: { width: 1200, height: 400, channels: 3 } })
        .jpeg({ quality: 90 })
        .toBuffer(),
  },
  {
    name: 'signature-scan-small.jpg',
    build: () =>
      sharp(signatureRaw(300, 100, 6), { raw: { width: 300, height: 100, channels: 3 } })
        .jpeg({ quality: 70 })
        .toBuffer(),
  },
  {
    name: 'signature-scan.png',
    build: () =>
      sharp(signatureRaw(800, 300, 7), { raw: { width: 800, height: 300, channels: 3 } })
        .png()
        .toBuffer(),
  },
  {
    name: 'tiny-8kb.jpg',
    build: () =>
      sharp(photoRaw(320, 240, 8), { raw: { width: 320, height: 240, channels: 3 } })
        .jpeg({ quality: 60 })
        .toBuffer(),
  },
  {
    name: 'already-small.jpg',
    build: () =>
      sharp(photoRaw(600, 800, 9, 12), { raw: { width: 600, height: 800, channels: 3 } })
        .jpeg({ quality: 42 })
        .toBuffer(),
  },
  {
    name: 'transparent-logo.png',
    build: async () => {
      const width = 900;
      const height = 700;
      const buf = Buffer.alloc(width * height * 4, 0);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          const inside = Math.hypot(x - width / 2, y - height / 2) < 250;
          if (inside) {
            buf[i] = 210;
            buf[i + 1] = 40;
            buf[i + 2] = 60;
            buf[i + 3] = 255;
          }
        }
      }
      return sharp(buf, { raw: { width, height, channels: 4 } }).png().toBuffer();
    },
  },
  {
    name: 'transparent-signature.png',
    build: async () => {
      const width = 800;
      const height = 300;
      const rgb = signatureRaw(width, height, 10);
      const rgba = Buffer.alloc(width * height * 4);
      for (let p = 0; p < width * height; p += 1) {
        const dark = rgb[p * 3]! < 128;
        rgba[p * 4] = 15;
        rgba[p * 4 + 1] = 15;
        rgba[p * 4 + 2] = 25;
        rgba[p * 4 + 3] = dark ? 255 : 0; // transparent page, opaque ink
      }
      return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
    },
  },
  {
    name: 'scanned-a4-300dpi.jpg',
    build: async () => {
      const width = 2480;
      const height = 3508;
      const buf = Buffer.alloc(width * height * 3, 0xf4);
      const random = rng(11);
      for (let line = 0; line < 60; line += 1) {
        const y0 = 200 + line * 50;
        for (let y = y0; y < y0 + 18 && y < height; y += 1) {
          for (let x = 200; x < width - 200; x += 1) {
            if (random() > 0.55) continue;
            const i = (y * width + x) * 3;
            buf[i] = 40;
            buf[i + 1] = 40;
            buf[i + 2] = 45;
          }
        }
      }
      return sharp(buf, { raw: { width, height, channels: 3 } }).jpeg({ quality: 85 }).toBuffer();
    },
  },
  {
    name: 'grayscale-photo.jpg',
    build: () =>
      sharp(photoRaw(1600, 1200, 12), { raw: { width: 1600, height: 1200, channels: 3 } })
        .grayscale()
        .jpeg({ quality: 88 })
        .toBuffer(),
  },
  {
    name: 'square-passport.jpg',
    build: () =>
      sharp(photoRaw(1500, 1500, 13), { raw: { width: 1500, height: 1500, channels: 3 } })
        .jpeg({ quality: 90 })
        .toBuffer(),
  },
  {
    name: 'panorama-wide.jpg',
    build: () =>
      sharp(photoRaw(5000, 1000, 14), { raw: { width: 5000, height: 1000, channels: 3 } })
        .jpeg({ quality: 88 })
        .toBuffer(),
  },
  {
    name: 'tall-narrow.jpg',
    build: () =>
      sharp(photoRaw(600, 4200, 15), { raw: { width: 600, height: 4200, channels: 3 } })
        .jpeg({ quality: 88 })
        .toBuffer(),
  },
  {
    name: 'one-pixel.png',
    build: () =>
      sharp(Buffer.from([200, 30, 30]), { raw: { width: 1, height: 1, channels: 3 } })
        .png()
        .toBuffer(),
  },
  {
    name: 'exif-gps-rotated.jpg',
    build: async () => {
      // Orientation 6 plus GPS tags: exercises EXIF rotation and the guarantee
      // that no location data survives into the output (acceptance test 7).
      const base = await sharp(photoRaw(1800, 1200, 16), {
        raw: { width: 1800, height: 1200, channels: 3 },
      })
        .jpeg({ quality: 90 })
        .toBuffer();
      return sharp(base)
        .withMetadata({
          orientation: 6,
          exif: {
            IFD0: { Make: 'SizeFit', Model: 'FixtureCam', Copyright: 'fixture' },
            IFD3: {
              GPSLatitudeRef: 'N',
              GPSLatitude: '28/1 36/1 48/1',
              GPSLongitudeRef: 'E',
              GPSLongitude: '77/1 12/1 30/1',
            },
          },
        })
        .toBuffer();
    },
  },
  {
    name: 'cmyk-print.jpg',
    build: () =>
      sharp(photoRaw(1400, 1000, 17), { raw: { width: 1400, height: 1000, channels: 3 } })
        .toColourspace('cmyk')
        .jpeg({ quality: 88 })
        .toBuffer(),
  },
  {
    name: 'high-contrast-barcode.png',
    build: async () => {
      const width = 1000;
      const height = 400;
      const buf = Buffer.alloc(width * height * 3, 0xff);
      const random = rng(18);
      let x = 0;
      while (x < width) {
        const w = 2 + Math.floor(random() * 8);
        const dark = random() > 0.4;
        if (dark) {
          for (let xx = x; xx < Math.min(width, x + w); xx += 1) {
            for (let y = 0; y < height; y += 1) {
              const i = (y * width + xx) * 3;
              buf[i] = 0;
              buf[i + 1] = 0;
              buf[i + 2] = 0;
            }
          }
        }
        x += w;
      }
      return sharp(buf, { raw: { width, height, channels: 3 } }).png().toBuffer();
    },
  },
];

/**
 * HEIC/HEIF input (§5.3). Only generated when this libvips build has a HEIF
 * encoder; the integration test skips the HEIC case with a warning otherwise.
 */
async function buildHeicIfSupported(): Promise<{ name: string; data: Buffer } | null> {
  try {
    const data = await sharp(photoRaw(2000, 1500, 19), {
      raw: { width: 2000, height: 1500, channels: 3 },
    })
      .heif({ compression: 'hevc', quality: 80 })
      .toBuffer();
    return { name: 'iphone-photo.heic', data };
  } catch {
    return null;
  }
}

export async function generateFixtures(): Promise<string[]> {
  await mkdir(FIXTURE_DIR, { recursive: true });
  const written: string[] = [];

  for (const spec of specs) {
    const path = join(FIXTURE_DIR, spec.name);
    if (!(await exists(path))) {
      await writeFile(path, await spec.build());
    }
    written.push(path);
  }

  const heic = await buildHeicIfSupported();
  if (heic) {
    const path = join(FIXTURE_DIR, heic.name);
    if (!(await exists(path))) await writeFile(path, heic.data);
    written.push(path);
  }

  // Deliberately broken inputs (§5.3).
  const zero = join(FIXTURE_DIR, 'zero-byte.jpg');
  if (!(await exists(zero))) await writeFile(zero, Buffer.alloc(0));
  const truncated = join(FIXTURE_DIR, 'truncated.jpg');
  if (!(await exists(truncated))) {
    const whole = await sharp(photoRaw(800, 600, 20), {
      raw: { width: 800, height: 600, channels: 3 },
    })
      .jpeg({ quality: 80 })
      .toBuffer();
    await writeFile(truncated, whole.subarray(0, 64));
  }

  return written;
}

async function exists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.size > 0 || path.endsWith('zero-byte.jpg');
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const files = await generateFixtures();
  const names = await readdir(FIXTURE_DIR);
  console.log(`Generated ${files.length} fixtures in ${FIXTURE_DIR}`);
  for (const name of names.sort()) {
    const s = await stat(join(FIXTURE_DIR, name));
    console.log(`  ${name.padEnd(30)} ${(s.size / 1024).toFixed(1)} KB`);
  }
}

// No top-level await: the app package is CommonJS-flavoured so Metro stays happy.
if (process.argv[1] && process.argv[1].endsWith('generate.ts')) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
