// Thins the drawings' polylines before they are inlined. A drawing samples its
// curves every few units, so many of its points sit a fraction of a unit from
// the line between their neighbours. Ramer-Douglas-Peucker drops every point
// within `tol` viewBox units of the line between the points it keeps. Only
// plain polylines ("M x,y L x,y ... Z") are touched: curves, arcs and every
// other spelling pass through unchanged.

type Point = [number, number];

/** A quarter of a viewBox unit: well under the 1.1-unit base stroke. */
const TOL = 0.25;

// An unambiguous number: `\d+\.?\d*` could split the same digits two ways, and
// a failing match would then backtrack through every split.
const NUM = String.raw`-?(?:\d+(?:\.\d*)?|\.\d+)`;
const PAIR = `${NUM},${NUM}`;
// One subpath: an M, any number of L, an optional closing Z. Every command
// takes exactly one x,y pair, so "M0 0 L1 0" and "L1,0 2,0" are not plain.
const SUBPATH = new RegExp(String.raw`M${PAIR}(?:\s*L${PAIR})*(?:\s*Z)?`, 'g');
const PAIRS = new RegExp(`(${NUM}),(${NUM})`, 'g');

/** The subpaths of a plain polyline, or null when `d` is anything else. */
function plainSubpaths(d: string): string[] | null {
  const subs = d.match(SUBPATH);
  return subs && d.replace(SUBPATH, '').trim() === '' ? subs : null;
}

/** Distance from `p` to the segment a-b (to `a` itself when the two coincide). */
function distance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  const ex = p[0] - a[0] - t * dx, ey = p[1] - a[1] - t * dy;
  // Not Math.hypot: its last bit differs between engines (Bun writes the snapshots, Node builds the
  // site), and an exact tie between two points must break the same way in both. Plain IEEE arithmetic
  // is identical everywhere, and at coordinates of 0-600 the squares cannot overflow.
  return Math.sqrt(ex * ex + ey * ey);
}

/** Ramer-Douglas-Peucker: the points worth keeping, both ends always among them. */
function simplify(pts: Point[], tol: number): Point[] {
  const keep = pts.map((_, i) => i === 0 || i === pts.length - 1);
  const visit = (lo: number, hi: number): void => {
    let far = -1, dmax = tol;
    for (let i = lo + 1; i < hi; i++) {
      const d = distance(pts[i], pts[lo], pts[hi]);
      // Strictly greater: on a tie the first farthest point is the one to split at.
      if (d > dmax) {
        dmax = d;
        far = i;
      }
    }
    if (far < 0) return;
    keep[far] = true;
    visit(lo, far);
    visit(far, hi);
  };
  visit(0, pts.length - 1);
  return pts.filter((_, i) => keep[i]);
}

const num = (n: number): string => String(Math.round(n * 10) / 10);
const print = (p: Point): string => num(p[0]) + ',' + num(p[1]);

/** Simplifies a plain polyline path to within `tol` units, or returns any other path as it is. */
export function thinPath(d: string, tol = TOL): string {
  const subs = plainSubpaths(d);
  if (!subs) return d;
  return subs
    .map((sub) => {
      const closed = sub.endsWith('Z');
      const pts = [...sub.matchAll(PAIRS)].map((m): Point => [Number(m[1]), Number(m[2])]);
      // A closed subpath is a loop: simplify it back to its first point, then let Z close it.
      const kept = closed ? simplify([...pts, pts[0]], tol).slice(0, -1) : simplify(pts, tol);
      return 'M' + kept.map(print).join(' L') + (closed ? ' Z' : '');
    })
    .join(' ');
}

/** `thinPath` on every d="..." attribute of an SVG string. */
export function thinSvg(svg: string, tol = TOL): string {
  return svg.replace(/ d="([^"]*)"/g, (_, d: string) => ` d="${thinPath(d, tol)}"`);
}
