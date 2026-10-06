// The Franka Panda in 3D (metres, z up): its planar chain, stood in the
// vertical plane through its base and its hand, drawn as filled solids.
import { type Point, rd } from './geom';
import type { Pen } from './pen';
import { type V3, type Cam, add3, dot3, scale3, cross3, norm3, cyl, box3, link } from './d3';

const add = (a: Point, b: Point, k = 1): Point => [a[0] + b[0] * k, a[1] + b[1] * k];
const dir = (deg: number): Point => [Math.sin(rd(deg)), Math.cos(rd(deg))];
const unit = (deg: number): Point => [Math.cos(rd(deg)), Math.sin(rd(deg))];
/** Rotate v about the unit axis k by angle a (radians). */
function rot3(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a), kv = cross3(k, v), kd = dot3(k, v);
  return [0, 1, 2].map((i) => v[i] * c + kv[i] * s + k[i] * kd * (1 - c)) as V3;
}

/** The Panda's chain in its own plane (metres: x out from the base, y up). */
function fk(a1: number, a2: number, handDeg: number) {
  const hd = unit(handDeg), pp: Point = [-hd[1], hd[0]];
  const J2: Point = [0, 0.333];
  const u1 = dir(a1), P3 = add(J2, u1, 0.316), n1: Point = [u1[1], -u1[0]];
  const J4 = add(P3, n1, 0.0825);
  const u2 = dir(a2), P5 = add(J4, n1, -0.0165), J6 = add(P5, u2, 0.384);
  const F = add(J6, pp, -0.088);
  const H = add(F, hd, 0.107);
  return { J2, P3, J4, P5, J6, F, H, hd, pp, u2 };
}
/** Joint angles that put the hand's centre at h, elbow up. */
function solve(h: Point, handDeg: number): [number, number] {
  let a1 = 10, a2 = 120;
  for (let it = 0; it < 80; it++) {
    const t = fk(a1, a2, handDeg).H, ex = h[0] - t[0], ey = h[1] - t[1];
    if (Math.hypot(ex, ey) < 1e-8) break;
    const d = 0.01, t1 = fk(a1 + d, a2, handDeg).H, t2 = fk(a1, a2 + d, handDeg).H;
    const j11 = (t1[0] - t[0]) / d, j21 = (t1[1] - t[1]) / d, j12 = (t2[0] - t[0]) / d, j22 = (t2[1] - t[1]) / d, det = j11 * j22 - j12 * j21;
    a1 += (j22 * ex - j12 * ey) / det; a2 += (-j21 * ex + j11 * ey) / det;
  }
  return [a1, a2];
}

type Arm3 = { base: V3; W: (q: Point) => V3; k: ReturnType<typeof fk>; A: V3; N: V3; hd: V3; pp: V3 };
/** The arm with its hand's centre at H, the hand pitched by `pitch` degrees. */
export function pose3(base: V3, H: V3, pitch: number): Arm3 {
  const az = Math.atan2(H[1] - base[1], H[0] - base[0]);
  const A: V3 = [Math.cos(az), Math.sin(az), 0], Z: V3 = [0, 0, 1], N = cross3(A, Z);
  const rel = add3(H, base, -1);
  const [a1, a2] = solve([Math.hypot(rel[0], rel[1]), rel[2]], pitch);
  const k = fk(a1, a2, pitch);
  const W = (q: Point): V3 => add3(add3(base, A, q[0]), Z, q[1]);
  return { base, W, k, A, N, hd: norm3(add3(scale3(A, k.hd[0]), Z, k.hd[1])), pp: norm3(add3(scale3(A, k.pp[0]), Z, k.pp[1])) };
}
/** The hand rolled about its approach direction: the fingers' opening direction, and a held object's axis and centre. */
export function hand3(arm: Arm3, roll: number) {
  const H = arm.W(arm.k.H), fo = rot3(arm.N, arm.hd, roll), g = rot3(arm.pp, arm.hd, roll);
  return { H, fo, g, th: cross3(fo, arm.hd), gc: add3(H, arm.hd, 0.08) };
}
/** Joints worth fitting a camera to. */
export function reach3(arm: Arm3): V3[] {
  return [arm.k.J2, arm.k.J4, arm.k.J6].map(arm.W).flatMap((q) => [add3(q, [0, 0, 0.08]), add3(q, arm.N, 0.09), add3(q, arm.N, -0.09)]);
}

/** Draws the arm. `gap` is half the opening between the fingers; `hold` is drawn between them, in depth order. */
export function franka3(p: Pen, cam: Cam, arm: Arm3, o: { roll?: number; gap?: number; hold?: { at: V3; draw: () => void } } = {}) {
  const { W, k, A, N, hd } = arm;
  box3(p, cam, add3(add3(arm.base, A, -0.15), N, -0.1), scale3(A, 0.26), scale3(N, 0.2), [0, 0, 0.07]);
  link(p, cam, W([0, 0.07]), W(k.J2), 0.06);
  cyl(p, cam, add3(W(k.J2), N, -0.085), N, 0.07, 0.17);
  link(p, cam, W(k.J2), W(k.P3), 0.052, 0.05);
  link(p, cam, W(k.P3), W(k.J4), 0.056);
  cyl(p, cam, add3(W(k.J4), N, -0.07), N, 0.062, 0.14);
  link(p, cam, W(k.P5), W(add(k.J6, k.u2, -0.03)), 0.05, 0.04);
  link(p, cam, W(add(k.J6, k.pp, 0.02)), W(k.F), 0.048);
  cyl(p, cam, add3(W(k.J6), N, -0.06), N, 0.05, 0.12);
  cyl(p, cam, W(k.F), hd, 0.042, 0.07);
  const { H, fo, th } = hand3(arm, o.roll ?? 0);
  const parts: { at: V3; draw: () => void }[] = [
    { at: H, draw: () => box3(p, cam, add3(add3(add3(H, fo, -0.1), hd, -0.028), th, -0.036), scale3(fo, 0.2), scale3(hd, 0.056), scale3(th, 0.072)) },
  ];
  if (o.hold) parts.push(o.hold);
  for (const s of [-1, 1]) {
    const b = add3(add3(H, fo, s * ((o.gap ?? 0.03) + 0.009)), hd, 0.028);
    parts.push({ at: add3(b, hd, 0.03), draw: () => box3(p, cam, add3(add3(b, fo, -0.009), th, -0.011), scale3(fo, 0.018), scale3(hd, 0.066), scale3(th, 0.022)) });
  }
  parts.sort((a, b) => cam.depth(a.at) - cam.depth(b.at)).forEach((q) => q.draw());
}
