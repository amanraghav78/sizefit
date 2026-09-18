/**
 * Format and metadata detection from the first bytes of a file.
 *
 * Pure byte inspection, so it is testable without a device. A codec uses it in
 * `probe` to answer two questions:
 *
 *   1. What is this file really? (extensions lie, especially `.jpg` on HEIC)
 *   2. Does it carry metadata? If it does, the file can never be passed
 *      through untouched, because GPS data must not survive (§10).
 *
 * Only a header slice is needed - metadata segments live at the start of both
 * JPEG and PNG. HEAD_BYTES is a generous window over that.
 */
import type { ProbeResult } from './types';

/** Enough to cover the marker/chunk region of any normal file. */
export const HEAD_BYTES = 65_536;

export function detectFormat(head: Uint8Array): ProbeResult['format'] {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return 'jpeg';
  }
  // "%PDF-" — the header the spec requires at byte zero.
  if (head.length >= 5 && ascii(head, 0, 5) === '%PDF-') {
    return 'pdf';
  }
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47
  ) {
    return 'png';
  }
  // ISO-BMFF: "....ftyp" followed by a HEIF/AVIF brand.
  if (head.length >= 12 && ascii(head, 4, 4) === 'ftyp') {
    const brand = ascii(head, 8, 4);
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'mif1', 'msf1', 'avif'].includes(brand)) {
      return 'heic';
    }
  }
  return 'other';
}

/**
 * True if the file carries metadata we are obliged to strip - EXIF, XMP, IPTC,
 * or an embedded colour profile.
 *
 * Deliberately errs towards `true`: a false positive only costs a re-encode,
 * while a false negative would pass GPS coordinates straight through.
 */
export function hasMetadata(head: Uint8Array): boolean {
  switch (detectFormat(head)) {
    case 'jpeg':
      return jpegHasMetadata(head);
    case 'png':
      return pngHasMetadata(head);
    case 'heic':
      return true; // HEIC is always re-encoded anyway
    case 'pdf':
      // A PDF's /Info dictionary and any XMP packet are rewritten by
      // pdfCompress, so a PDF is never passed through untouched either.
      return true;
    default:
      return true;
  }
}

/**
 * Walks the JPEG marker chain looking for any APPn segment other than APP0
 * (JFIF), which carries no personal data.
 */
function jpegHasMetadata(head: Uint8Array): boolean {
  let offset = 2; // skip SOI
  while (offset + 4 <= head.length) {
    if (head[offset] !== 0xff) return false; // not a marker: give up, assume clean
    const marker = head[offset + 1]!;

    // Start of scan / end of image: no metadata segments beyond this point.
    if (marker === 0xda || marker === 0xd9) return false;
    // Standalone markers carry no length field.
    if (marker >= 0xd0 && marker <= 0xd8) {
      offset += 2;
      continue;
    }

    const length = ((head[offset + 2]! << 8) | head[offset + 3]!) >>> 0;
    if (length < 2) return false;
    // APP1..APP15 hold EXIF, XMP, IPTC and friends. APP0 is JFIF: harmless.
    if (marker >= 0xe1 && marker <= 0xef) return true;
    offset += 2 + length;
  }
  return false;
}

const PNG_METADATA_CHUNKS = ['eXIf', 'tEXt', 'iTXt', 'zTXt', 'iCCP'];

function pngHasMetadata(head: Uint8Array): boolean {
  let offset = 8; // skip signature
  while (offset + 8 <= head.length) {
    const length = readUint32(head, offset);
    const type = ascii(head, offset + 4, 4);
    if (type === 'IDAT' || type === 'IEND') return false; // pixel data starts here
    if (PNG_METADATA_CHUNKS.includes(type)) return true;
    offset += 12 + length; // length + type + data + crc
    if (length < 0) return false;
  }
  return false;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = offset; i < offset + length && i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]!);
  }
  return out;
}
