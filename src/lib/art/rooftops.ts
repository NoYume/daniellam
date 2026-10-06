// SBI: an isometric block of buildings, each roof linked to its nearest
// neighbours, so the buildings share what they know with each other and no
// node sits above them.
import { type Point, L, poly, arcPts, cubic } from './geom';
import { Pen } from './pen';

type Iso = (x: number, y: number, z: number) => Point;
const isoAt = (ox: number, oy: number, s: number): Iso => (x, y, z) => [ox + (x - y) * 0.866 * s, oy + (x + y) * 0.5 * s - z * s];

/** An isometric box: its three visible faces filled, floor lines on its sides. */
function box(p: Pen, iso: Iso, x: number, y: number, w: number, d: number, h: number, floors = 0, op = 1) {
  const top = [iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)];
  const left = [iso(x, y + d, 0), iso(x + w, y + d, 0), iso(x + w, y + d, h), iso(x, y + d, h)];
  const right = [iso(x + w, y, 0), iso(x + w, y + d, 0), iso(x + w, y + d, h), iso(x + w, y, h)];
  p.Fill(poly(left, true), op);
  p.Fill(poly(right, true), op);
  p.Fill(poly(top, true), op);
  if (floors) {
    let fl = '';
    for (let k = 1; k < floors; k++) {
      const z = (h * k) / floors;
      fl += L(iso(x, y + d, z), iso(x + w, y + d, z)) + L(iso(x + w, y + d, z), iso(x + w, y, z));
    }
    p.B(fl, 0.55 * op);
  }
}

// Ten lots, one building each, on a 10 x 10 grid: x, y, width, depth, height.
const LOTS: [number, number, number, number, number][] = [
  [0.5, 0.5, 2, 2, 5], [3.4, 0.6, 1.6, 2.2, 8.5], [6, 0.5, 2.6, 1.8, 4], [0.6, 3.5, 2, 2.2, 3.4], [3.5, 3.6, 2.2, 2, 6.2],
  [6.4, 3.2, 2, 2.4, 10], [0.6, 6.6, 2.4, 2, 7], [3.8, 6.8, 1.8, 2.2, 3], [6.2, 6.6, 1.6, 1.6, 5.4], [8.3, 6.4, 1.4, 2.8, 2.6],
];
/** The lots from the back of the block to the front, the order to draw them in. */
const backToFront = () => LOTS.map((l, i) => ({ l, i })).sort((a, b) => a.l[0] + a.l[1] + (a.l[2] + a.l[3]) / 2 - (b.l[0] + b.l[1] + (b.l[2] + b.l[3]) / 2));

export function rooftops(uid: string): string {
  // The block on its street grid; then each roof linked to its two nearest
  // neighbours, a few of the links lit.
  const p = new Pen(uid);
  const s = 25, iso = isoAt(300, 344, s);
  let g = '';
  for (let k = 0; k <= 10; k++) g += L(iso(k, 0, 0), iso(k, 10, 0)) + L(iso(0, k, 0), iso(10, k, 0));
  p.B(g, 0.35);
  const roofs: Point[] = [];
  for (const { l } of backToFront()) box(p, iso, l[0], l[1], l[2], l[3], l[4], Math.round(l[4] * 1.2));
  LOTS.forEach((l) => roofs.push(iso(l[0] + l[2] / 2, l[1] + l[3] / 2, l[4])));
  const plan = LOTS.map((l) => [l[0] + l[2] / 2, l[1] + l[3] / 2]);
  const key = (a: number, b: number) => (a < b ? a + ',' + b : b + ',' + a);
  const edges = new Set<string>();
  plan.forEach((q, i) => {
    plan.map((o, j) => ({ j, d: Math.hypot(o[0] - q[0], o[1] - q[1]) })).filter((o) => o.j !== i).sort((a, b) => a.d - b.d).slice(0, 2).forEach((o) => edges.add(key(i, o.j)));
  });
  const lit = new Set(['1,4', '4,8', '0,3', '5,9']);
  for (const e of edges) {
    const [a, b] = e.split(',').map(Number), A = roofs[a], B = roofs[b];
    const lift = 34 + Math.abs(A[0] - B[0]) * 0.12;
    const d = cubic(A, [A[0], Math.min(A[1], B[1]) - lift], [B[0], Math.min(A[1], B[1]) - lift], B);
    p.B(d, 0.9);
    if (lit.has(e)) { p.T(d); p.F(d, 4, a * 0.5); }
  }
  for (const r of roofs) { p.B(poly(arcPts(r, 8, 0, Math.PI * 2, 24).map((q) => [q[0], r[1] + (q[1] - r[1]) * 0.5] as Point), true)); p.dot(r, 2.2); }
  return p.svg('rooftops');
}
