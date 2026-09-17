import { describe, expect, it } from 'vitest';
import { MIN_SEGMENT_BYTES, isJpeg, padJpegToSize, planPaddedSize } from './jpegPadding';

function jpeg(size: number): Uint8Array {
  const out = new Uint8Array(size);
  out[0] = 0xff;
  out[1] = 0xd8;
  out.fill(0x42, 2, size - 2);
  out[size - 2] = 0xff;
  out[size - 1] = 0xd9;
  return out;
}

/** Walk the segment chain after SOI and return the padded byte count. */
function readCommentBytes(bytes: Uint8Array): number {
  let offset = 2;
  let total = 0;
  while (bytes[offset] === 0xff && bytes[offset + 1] === 0xfe) {
    const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    total += 2 + length;
    offset += 2 + length;
  }
  return total;
}

describe('planPaddedSize', () => {
  it('returns null when the file already meets the floor', () => {
    expect(planPaddedSize(10_000, 10_000)).toBeNull();
    expect(planPaddedSize(12_000, 10_000)).toBeNull();
  });

  it('targets the floor exactly for a shortfall of 4 bytes or more', () => {
    expect(planPaddedSize(9_000, 10_000)).toBe(10_000);
  });

  it('overshoots slightly for a shortfall no segment can express', () => {
    expect(planPaddedSize(9_998, 10_000)).toBe(9_998 + MIN_SEGMENT_BYTES);
  });
});

describe('padJpegToSize', () => {
  it('hits the requested size exactly', () => {
    const padded = padJpegToSize(jpeg(8 * 1024), 10 * 1024);
    expect(padded.length).toBe(10 * 1024);
  });

  it('keeps the SOI first and the original payload intact', () => {
    const original = jpeg(1000);
    const padded = padJpegToSize(original, 2000);
    expect(isJpeg(padded)).toBe(true);
    const commentBytes = readCommentBytes(padded);
    expect(commentBytes).toBe(1000);
    expect(Array.from(padded.subarray(2 + commentBytes))).toEqual(
      Array.from(original.subarray(2)),
    );
  });

  it('splits padding across segments beyond the 64KB segment limit', () => {
    const padded = padJpegToSize(jpeg(1000), 1000 + 200_000);
    expect(padded.length).toBe(201_000);
    expect(readCommentBytes(padded)).toBe(200_000);
  });

  it('handles a padding amount that would leave an unexpressible remainder', () => {
    const delta = 65_537 + 2; // one full segment plus 2 bytes
    const padded = padJpegToSize(jpeg(500), 500 + delta);
    expect(padded.length).toBe(500 + delta);
    expect(readCommentBytes(padded)).toBe(delta);
  });

  it('is a no-op when the target equals the input size', () => {
    const original = jpeg(700);
    expect(padJpegToSize(original, 700)).toBe(original);
  });

  it('refuses non-JPEG input', () => {
    expect(() => padJpegToSize(new Uint8Array([0x89, 0x50]), 100)).toThrow(/not a JPEG/);
  });

  it('refuses to shrink', () => {
    expect(() => padJpegToSize(jpeg(1000), 900)).toThrow(/below input size/);
  });

  it('refuses a 1-3 byte delta', () => {
    expect(() => padJpegToSize(jpeg(1000), 1002)).toThrow(/smallest comment segment/);
  });
});
