/**
 * §5 Step 4 — floor fallback by JPEG comment padding.
 *
 * DO NOT "optimise" this away. Some portals reject files BELOW a minimum size
 * (e.g. "signature must be 10KB-20KB"). When an image is genuinely small, no
 * amount of quality can push it over the floor, so we append JPEG comment
 * segments (marker 0xFFFE) full of null bytes immediately after the SOI.
 *
 * This is valid JPEG: a COM segment is an ignorable ancillary segment. Every
 * decoder skips it, the rendered pixels are identical, and portal validators
 * that only check file size accept it.
 *
 * Segment layout: FF FE <2-byte big-endian length> <length-2 bytes of data>.
 * The length field covers itself, so one segment adds 4 + dataLength bytes and
 * can carry at most 65533 data bytes.
 */

const SOI_0 = 0xff;
const SOI_1 = 0xd8;
const COM_MARKER_0 = 0xff;
const COM_MARKER_1 = 0xfe;

/** Smallest possible COM segment: marker + length field, no payload. */
export const MIN_SEGMENT_BYTES = 4;
const MAX_SEGMENT_BYTES = 2 + 0xffff; // 65537

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === SOI_0 && bytes[1] === SOI_1;
}

/**
 * The byte count we would actually pad to when aiming for `minBytes`.
 *
 * Padding is quantised: we can add 0 bytes, or 4 or more. A shortfall of 1-3
 * bytes therefore overshoots the floor slightly, which is harmless as long as
 * the result still fits under the ceiling — the caller checks that.
 *
 * Returns null when the file is already at or above the floor.
 */
export function planPaddedSize(currentBytes: number, minBytes: number): number | null {
  if (currentBytes >= minBytes) return null;
  const shortfall = minBytes - currentBytes;
  const added = Math.max(shortfall, MIN_SEGMENT_BYTES);
  return currentBytes + added;
}

/**
 * Pad a JPEG to exactly `targetBytes`.
 *
 * Throws if the input is not a JPEG, if the target is smaller than the input,
 * or if the difference is 1-3 bytes (not expressible as COM segments — use
 * `planPaddedSize` to pick a reachable target).
 */
export function padJpegToSize(bytes: Uint8Array, targetBytes: number): Uint8Array {
  if (!isJpeg(bytes)) {
    throw new Error('padJpegToSize: input is not a JPEG (missing SOI marker)');
  }
  const delta = targetBytes - bytes.length;
  if (delta === 0) return bytes;
  if (delta < 0) {
    throw new Error(`padJpegToSize: target ${targetBytes} is below input size ${bytes.length}`);
  }
  if (delta < MIN_SEGMENT_BYTES) {
    throw new Error(
      `padJpegToSize: cannot add ${delta} bytes; the smallest comment segment is ${MIN_SEGMENT_BYTES}`,
    );
  }

  const segments = splitIntoSegments(delta);
  const out = new Uint8Array(targetBytes);
  out[0] = SOI_0;
  out[1] = SOI_1;

  let offset = 2;
  for (const segmentBytes of segments) {
    const dataLength = segmentBytes - MIN_SEGMENT_BYTES;
    const lengthField = dataLength + 2;
    out[offset++] = COM_MARKER_0;
    out[offset++] = COM_MARKER_1;
    out[offset++] = (lengthField >> 8) & 0xff;
    out[offset++] = lengthField & 0xff;
    // Payload is already zero-filled by the Uint8Array allocation.
    offset += dataLength;
  }

  out.set(bytes.subarray(2), offset);
  return out;
}

/**
 * Break a total byte count into per-segment sizes, never leaving a 1-3 byte
 * remainder that no segment could express.
 */
function splitIntoSegments(total: number): number[] {
  const segments: number[] = [];
  let remaining = total;
  while (remaining > 0) {
    let size = Math.min(remaining, MAX_SEGMENT_BYTES);
    const rest = remaining - size;
    if (rest > 0 && rest < MIN_SEGMENT_BYTES) {
      size -= MIN_SEGMENT_BYTES;
    }
    segments.push(size);
    remaining -= size;
  }
  return segments;
}
