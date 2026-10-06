// The site's line-art system: faint base strokes, gradient tint strokes and
// traveling flow dashes, collected by a Pen into one drawing.
import { f, type Point } from './geom';

/** Every drawing's frame: its viewBox, and the extent of its gradients. */
const W = 600, H = 600;

function grad(id: string, rev: boolean): string {
  const stops = ['var(--g1)', 'var(--g2)', 'var(--g3)'];
  if (rev) stops.reverse();
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${H}">` +
    stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" style="stop-color:${c}"/>`).join('') + '</linearGradient>';
}

/** Collects one drawing's strokes. */
export class Pen {
  base = ''; flow = ''; dots = '';
  constructor(public uid: string) {}
  get id() { return `${this.uid}-g`; }
  get idr() { return `${this.uid}-gr`; }
  /** Faint base stroke. `op` scales the base opacity (1 = normal). */
  B(d: string, op = 1) { this.base += '<path class="la-base" d="' + d + '"' + (op !== 1 ? ` style="stroke-opacity:calc(var(--base-op) * ${op})"` : '') + '/>'; }
  /** A base stroke over a fill of the line-art background (`--la-bg`), to hide what lies behind it. */
  Fill(d: string, op = 1) { this.base += '<path class="la-base" d="' + d + '" style="fill:var(--la-bg)' + (op !== 1 ? `;stroke-opacity:calc(var(--base-op) * ${op})` : '') + '"/>'; }
  F(d: string, dur = 7, delay = 0, rev = false) {
    this.flow += '<path class="la-flow" stroke="url(#' + (rev ? this.idr : this.id) + ')" style="animation-duration:' + dur + 's;animation-delay:-' + delay + 's" d="' + d + '"/>';
  }
  T(d: string, rev = false) { this.flow += '<path class="la-tint" stroke="url(#' + (rev ? this.idr : this.id) + ')" d="' + d + '"/>'; }
  dot(p: Point, r = 2.6) { this.dots += '<circle class="la-dot" cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="' + r + '"/>'; }
  accent(p: Point, r = 6, c = 'var(--g2)') { this.dots += '<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="' + r + '" style="fill:' + c + '"/>'; }
  svg(key: string) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false" data-art="${key}">` +
      '<defs>' + grad(this.id, false) + grad(this.idr, true) + '</defs>' + this.base + this.dots + this.flow + '</svg>';
  }
}
