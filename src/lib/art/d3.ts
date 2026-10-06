// A small orthographic camera for line drawings of 3D scenes (metres, z up),
// with the solids those scenes need: boxes, cylinders, capsules.
import { type Point, f, poly, L } from './geom';
import type { Pen } from './pen';

export type V3 = [number, number, number];
export const add3 = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
export const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const scale3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const norm3 = (a: V3): V3 => scale3(a, 1 / Math.hypot(a[0], a[1], a[2]));

export type Cam = { P: (p: V3) => Point; depth: (p: V3) => number; C: V3; S: number };
/** Orthographic camera: azimuth turns it about z (0 looks along +y), elevation tips it down. */
function camera(azDeg: number, elDeg: number, S = 1, ox = 0, oy = 0): Cam {
  const a = (azDeg * Math.PI) / 180, b = (elDeg * Math.PI) / 180;
  const R: V3 = [Math.cos(a), -Math.sin(a), 0];
  const U: V3 = [Math.sin(a) * Math.sin(b), Math.cos(a) * Math.sin(b), Math.cos(b)];
  const C: V3 = [-Math.sin(a) * Math.cos(b), -Math.cos(a) * Math.cos(b), Math.sin(b)];
  return { P: (p) => [ox + S * dot3(p, R), oy - S * dot3(p, U)], depth: (p) => dot3(p, C), C, S };
}
/** The same camera, scaled and moved so the given points fill the box [x0, x1] x [y0, y1]. */
export function fit(azDeg: number, elDeg: number, pts: V3[], x0: number, y0: number, x1: number, y1: number): Cam {
  const c = camera(azDeg, elDeg), q = pts.map(c.P);
  const mx = Math.min(...q.map((p) => p[0])), Mx = Math.max(...q.map((p) => p[0]));
  const my = Math.min(...q.map((p) => p[1])), My = Math.max(...q.map((p) => p[1]));
  const S = Math.min((x1 - x0) / (Mx - mx), (y1 - y0) / (My - my));
  return camera(azDeg, elDeg, S, (x0 + x1) / 2 - S * (mx + Mx) / 2, (y0 + y1) / 2 - S * (my + My) / 2);
}

export function hull(pts: Point[]): Point[] {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Point[] = [], up: Point[] = [];
  for (const q of s) { while (lo.length >= 2 && cr(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop(); lo.push(q); }
  for (const q of s.reverse()) { while (up.length >= 2 && cr(up[up.length - 2]!, up[up.length - 1]!, q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
export function basis(a: V3): [V3, V3] {
  const t: V3 = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const e1 = norm3(cross3(a, t));
  return [e1, cross3(a, e1)];
}
/** Points around a circle in 3D. */
export function ring(c: V3, axis: V3, r: number, n = 48): V3[] {
  const [e1, e2] = basis(axis);
  return Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return add3(add3(c, e1, r * Math.cos(t)), e2, r * Math.sin(t)); });
}
export const path3 = (cam: Cam, pts: V3[], close = false) => poly(pts.map(cam.P), close);
/** n + 1 points along a cubic Bezier curve in 3D. */
export function bez3(p0: V3, p1: V3, p2: V3, p3: V3, n = 90): V3[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t;
    return [0, 1, 2].map((k) => u * u * u * p0[k]! + 3 * u * u * t * p1[k]! + 3 * u * t * t * p2[k]! + t * t * t * p3[k]!) as V3;
  });
}

/** A cylinder from c along axis (unit), filled, with the end that faces the camera drawn. */
export function cyl(p: Pen, cam: Cam, c: V3, axis: V3, r: number, h: number, op = 1) {
  const top = add3(c, axis, h), r0 = ring(c, axis, r), r1 = ring(top, axis, r);
  p.Fill(poly(hull([...r0, ...r1].map(cam.P)), true), op);
  const facing = dot3(axis, cam.C) > 0 ? r1 : r0;
  if (Math.abs(dot3(axis, cam.C)) > 0.04) p.B(path3(cam, facing, true), op);
  return { top, r0, r1, facingTop: dot3(axis, cam.C) > 0 };
}
/** A box from corner o along three edge vectors: its visible faces, filled. */
export function box3(p: Pen, cam: Cam, o: V3, ex: V3, ey: V3, ez: V3, op = 1) {
  const c = (i: number, j: number, k: number) => add3(add3(add3(o, ex, i), ey, j), ez, k);
  const mid = c(0.5, 0.5, 0.5);
  const quads: V3[][] = [
    [c(0, 0, 0), c(1, 0, 0), c(1, 1, 0), c(0, 1, 0)], [c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1)],
    [c(0, 0, 0), c(1, 0, 0), c(1, 0, 1), c(0, 0, 1)], [c(0, 1, 0), c(1, 1, 0), c(1, 1, 1), c(0, 1, 1)],
    [c(0, 0, 0), c(0, 1, 0), c(0, 1, 1), c(0, 0, 1)], [c(1, 0, 0), c(1, 1, 0), c(1, 1, 1), c(1, 0, 1)],
  ];
  const vis: V3[][] = [];
  for (const q of quads) {
    const m = q.reduce((s, v) => add3(s, v, 0.25), [0, 0, 0] as V3);
    if (dot3(add3(m, mid, -1), cam.C) > 1e-9) vis.push(q);
  }
  for (const q of vis) p.Fill(path3(cam, q, true), op);
  return { c, vis };
}
/** The outline of a capsule from a to b, radius r at a and r2 at b. */
function capsule(a: Point, b: Point, r: number, r2 = r): string {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const p1: Point = [a[0] + nx * r, a[1] + ny * r], p2: Point = [b[0] + nx * r2, b[1] + ny * r2];
  const p3: Point = [b[0] - nx * r2, b[1] - ny * r2], p4: Point = [a[0] - nx * r, a[1] - ny * r];
  return `M${f(p1[0])},${f(p1[1])} L${f(p2[0])},${f(p2[1])} A${r2},${r2} 0 0 0 ${f(p3[0])},${f(p3[1])} L${f(p4[0])},${f(p4[1])} A${r},${r} 0 0 0 ${f(p1[0])},${f(p1[1])} Z`;
}
/** A link between two points: a capsule of radius r (metres). */
export function link(p: Pen, cam: Cam, a: V3, b: V3, r: number, r2 = r, op = 1) {
  p.Fill(capsule(cam.P(a), cam.P(b), r * cam.S, r2 * cam.S), op);
}
export const seg3 = (cam: Cam, a: V3, b: V3) => L(cam.P(a), cam.P(b));
