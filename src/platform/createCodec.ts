import type { ImageCodec } from '../core/types';
import { ExpoImageCodec } from './expoImageCodec';

/** The codec the app runs on. Metro swaps in createCodec.web.ts for web. */
export function createCodec(): ImageCodec {
  return new ExpoImageCodec();
}
