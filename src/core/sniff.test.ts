import { describe, expect, it } from 'vitest';
import { detectFormat, hasMetadata } from './sniff';

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

/** JPEG SOI + a sequence of APPn segments + SOS. */
function jpegWith(segments: Array<{ marker: number; payload: number[] }>): Uint8Array {
  const out: number[] = [0xff, 0xd8];
  for (const { marker, payload } of segments) {
    const length = payload.length + 2;
    out.push(0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload);
  }
  out.push(0xff, 0xda, 0x00, 0x02); // SOS
  return new Uint8Array(out);
}

/** PNG signature + IHDR + the given chunks + IDAT. */
function pngWith(chunkTypes: string[]): Uint8Array {
  const out: number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const chunk = (type: string, dataLength: number) => {
    out.push(
      (dataLength >> 24) & 0xff,
      (dataLength >> 16) & 0xff,
      (dataLength >> 8) & 0xff,
      dataLength & 0xff,
    );
    for (const char of type) out.push(char.charCodeAt(0));
    for (let i = 0; i < dataLength; i += 1) out.push(0);
    out.push(0, 0, 0, 0); // crc
  };
  chunk('IHDR', 13);
  for (const type of chunkTypes) chunk(type, 8);
  chunk('IDAT', 16);
  return new Uint8Array(out);
}

describe('detectFormat', () => {
  it('recognises JPEG, PNG and HEIC by their magic bytes', () => {
    expect(detectFormat(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
    expect(detectFormat(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');

    const heic = new Uint8Array(16);
    heic.set([0, 0, 0, 0x18], 0);
    for (const [i, char] of [...'ftypheic'].entries()) heic[4 + i] = char.charCodeAt(0);
    expect(detectFormat(heic)).toBe('heic');
  });

  it('does not trust the container alone — an MP4 is not an image', () => {
    const mp4 = new Uint8Array(16);
    for (const [i, char] of [...'ftypisom'].entries()) mp4[4 + i] = char.charCodeAt(0);
    expect(detectFormat(mp4)).toBe('other');
  });

  it('reports anything unrecognised as other', () => {
    expect(detectFormat(bytes(0x25, 0x50, 0x44, 0x46))).toBe('other'); // PDF
    expect(detectFormat(new Uint8Array(0))).toBe('other');
  });
});

describe('hasMetadata', () => {
  it('flags a JPEG carrying an EXIF APP1 segment', () => {
    const exif = jpegWith([{ marker: 0xe1, payload: [0x45, 0x78, 0x69, 0x66, 0, 0] }]);
    expect(hasMetadata(exif)).toBe(true);
  });

  it('flags XMP and IPTC too, not just EXIF', () => {
    expect(hasMetadata(jpegWith([{ marker: 0xe2, payload: [1, 2, 3] }]))).toBe(true);
    expect(hasMetadata(jpegWith([{ marker: 0xed, payload: [1, 2, 3] }]))).toBe(true);
  });

  it('accepts a bare JFIF-only JPEG as clean', () => {
    const jfif = jpegWith([{ marker: 0xe0, payload: [0x4a, 0x46, 0x49, 0x46, 0] }]);
    expect(hasMetadata(jfif)).toBe(false);
  });

  it('flags PNG metadata chunks', () => {
    expect(hasMetadata(pngWith(['eXIf']))).toBe(true);
    expect(hasMetadata(pngWith(['tEXt']))).toBe(true);
    expect(hasMetadata(pngWith(['iCCP']))).toBe(true);
  });

  it('accepts a PNG with no ancillary chunks', () => {
    expect(hasMetadata(pngWith([]))).toBe(false);
  });

  it('errs towards true for formats it cannot inspect', () => {
    // A false positive costs one re-encode; a false negative leaks GPS data.
    expect(hasMetadata(bytes(0x25, 0x50, 0x44, 0x46))).toBe(true);
  });
});
