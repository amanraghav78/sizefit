import type { ImageCodec } from '../core/types';
import { WebImageCodec } from './webImageCodec';

/** Web builds get the canvas codec. */
export function createCodec(): ImageCodec {
  return new WebImageCodec();
}
