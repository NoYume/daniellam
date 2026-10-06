// The line drawings, one per key: each is built as SVG markup at build time by
// its own module in ./art, then thinned before it is inlined.
import { boat } from './art/boat';
import { hud } from './art/hud';
import { pour } from './art/pour';
import { rooftops } from './art/rooftops';
import { thinSvg } from './art/thin';
import { vla } from './art/vla';
import { voice } from './art/voice';
import type { LineArtKey } from './lineart-keys';

const DRAW: Record<LineArtKey, (uid: string) => string> = { voice, hud, pour, vla, rooftops, boat };

/** Full <svg> markup for one drawing. `uid` keeps gradient ids unique when a drawing appears twice. */
export function lineArt(key: LineArtKey, uid: string): string {
  return thinSvg(DRAW[key](uid));
}
