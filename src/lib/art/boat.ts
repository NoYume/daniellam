// Texas Marine Robotics: a small twin-hull boat from behind and above. Its mast
// camera frames a gate of two pole buoys and the detector boxes both; the path
// runs through the gate and on past a ball buoy. Metres: x ahead of the boat,
// z up.
import { mulberry32 } from '../../../scripts/lib/random';
import { type Point, poly, f, circ, rd } from './geom';
import { Pen } from './pen';
import { type V3, type Cam, add3, scale3, dot3, fit, cyl, box3, link, ring, path3, basis, hull, seg3, bez3 } from './d3';

const Z: V3 = [0, 0, 1];
const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);

/** The run of points on a closed loop that pass `keep`, in order (the loop is cut once). */
function run(pts: V3[], keep: (q: V3) => boolean): V3[] {
  const k = pts.findIndex((q) => !keep(q));
  if (k < 0) return pts;
  return [...pts.slice(k), ...pts.slice(0, k)].filter(keep);
}

/**
 * A ball buoy floating with its centre c above the water: the outline of the part
 * above the water, closed by the near half of its waterline, seen along C.
 */
function ballOutline(c: V3, r: number, C: V3): V3[] {
  const [e1, e2] = basis(C), N = 120;
  const sil = Array.from({ length: N }, (_, i) => { const t = (i / N) * Math.PI * 2; return add3(add3(c, e1, r * Math.cos(t)), e2, r * Math.sin(t)); });
  if (c[2] >= r) return sil;
  const wl = ring([c[0], c[1], 0], Z, Math.sqrt(r * r - c[2] * c[2]), N);
  const top = run(sil, (q) => q[2] >= 0);
  const front = run(wl, (q) => dot3(add3(q, c, -1), C) > 0);
  const end = top[top.length - 1]!;
  const fwd = len3(add3(front[0]!, end, -1)) <= len3(add3(front[front.length - 1]!, end, -1));
  return [...top, ...(fwd ? front : [...front].reverse())];
}

/** A pole buoy standing in the water: a cylinder with a cone on top. Returns its outline points on the page. */
function pole(p: Pen, cam: Cam, c: V3, r: number, h: number, cone: number): Point[] {
  const b0: V3 = [c[0], c[1], 0], top: V3 = [c[0], c[1], h], apex = add3(top, Z, cone);
  cyl(p, cam, b0, Z, r, h);
  p.Fill(poly(hull([...ring(top, Z, r).map(cam.P), cam.P(apex)]), true));
  return [...ring(b0, Z, r).map(cam.P), ...ring(top, Z, r).map(cam.P), cam.P(apex)];
}
/** A ball buoy. Returns its outline points on the page. */
function ball(p: Pen, cam: Cam, c: V3, r: number): Point[] {
  const o = ballOutline(c, r, cam.C).map(cam.P);
  p.Fill(poly(o, true));
  return o;
}
/** Rings on the water around a buoy. */
function ripples(p: Pen, cam: Cam, c: V3, r: number) {
  p.B(path3(cam, ring([c[0], c[1], 0], Z, r + 0.07), true), 0.6);
  p.B(path3(cam, ring([c[0], c[1], 0], Z, r + 0.17), true), 0.3);
}
/** Corner brackets round a detection on the page. */
function brackets(p: Pen, pts: Point[], pad = 7) {
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
  const k = Math.min(10, (x1 - x0) * 0.3, (y1 - y0) * 0.3);
  const d = `M${f(x0)},${f(y0 + k)} L${f(x0)},${f(y0)} L${f(x0 + k)},${f(y0)} M${f(x1 - k)},${f(y0)} L${f(x1)},${f(y0)} L${f(x1)},${f(y0 + k)} ` +
    `M${f(x1)},${f(y1 - k)} L${f(x1)},${f(y1)} L${f(x1 - k)},${f(y1)} M${f(x0 + k)},${f(y1)} L${f(x0)},${f(y1)} L${f(x0)},${f(y1 - k)}`;
  p.T(d);
}

/** A small twin-hull autonomous boat at o, heading `yaw` degrees from +x, its camera on a mast near the bow. */
function vessel(p: Pen, cam: Cam, o: V3, yaw: number) {
  const a = rd(yaw), X: V3 = [Math.cos(a), Math.sin(a), 0], Y: V3 = [-Math.sin(a), Math.cos(a), 0];
  const W = (x: number, y: number, z: number): V3 => add3(add3(add3(o, X, x), Y, y), Z, z);
  const nearS = dot3(Y, cam.C) > 0 ? 1 : -1;
  // Hulls (far one first), then the deck across them.
  for (const s of [-nearS, nearS]) link(p, cam, W(-0.72, s * 0.32, 0.06), W(0.66, s * 0.32, 0.06), 0.085, 0.055);
  box3(p, cam, W(-0.54, -0.41, 0.13), scale3(X, 0.9), scale3(Y, 0.82), [0, 0, 0.04]);
  const parts: { at: V3; draw: () => void }[] = [
    // The electronics box (the Jetson rides in here).
    { at: W(-0.22, 0, 0.25), draw: () => box3(p, cam, W(-0.41, -0.17, 0.17), scale3(X, 0.38), scale3(Y, 0.34), [0, 0, 0.15]) },
    { at: W(0.2, 0, 0.36), draw: () => link(p, cam, W(0.2, 0, 0.17), W(0.2, 0, 0.58), 0.017, 0.017) },
    { at: W(0.2, 0, 0.62), draw: () => { box3(p, cam, W(0.13, -0.07, 0.58), scale3(X, 0.14), scale3(Y, 0.14), [0, 0, 0.08]); cyl(p, cam, W(0.27, 0, 0.62), X, 0.032, 0.035); } },
    { at: W(-0.48, 0.25, 0.3), draw: () => { link(p, cam, W(-0.48, 0.25, 0.17), W(-0.48, 0.25, 0.43), 0.011, 0.011); const q = cam.P(W(-0.48, 0.25, 0.45)); p.Fill(circ(q[0], q[1], 0.03 * cam.S)); } },
  ];
  parts.sort((m, n) => cam.depth(m.at) - cam.depth(n.at)).forEach((q) => q.draw());
}

/** Long wave lines across the water, level on the page; `keep` trims them. */
function waterRows(p: Pen, cam: Cam, centre: V3, rows: number, gap: number, half: number, amp: number, seed: number, op = 1, keep: (q: V3) => boolean = () => true) {
  const a = Math.atan2(-cam.C[0], -cam.C[1]); // the camera's azimuth
  const R: V3 = [Math.cos(a), -Math.sin(a), 0], D: V3 = [Math.sin(a), Math.cos(a), 0];
  const rnd = mulberry32(seed);
  const out: string[] = [];
  for (let i = 0; i < rows; i++) {
    const off = (i - (rows - 1) / 2) * gap, ph = rnd() * 6, w = half * (0.7 + 0.3 * rnd());
    let cur: V3[] = [];
    const flush = () => { if (cur.length > 1) out.push(path3(cam, cur)); cur = []; };
    for (let k = 0; k <= 120; k++) {
      const s = -w + (2 * w * k) / 120, q = add3(add3(centre, R, s), D, off + Math.sin(s * 3.1 + ph) * amp);
      if (keep(q)) cur.push(q); else flush();
    }
    flush();
  }
  out.forEach((d) => p.B(d, op));
}

/** Points of a path on the page, split into the runs no nearer buoy hides. */
function unhidden(pts: Point[], behind: (i: number, o: number) => boolean, outlines: Point[][]): Point[][] {
  const inside = (q: Point, poly2: Point[]) => {
    let c = false;
    for (let i = 0, j = poly2.length - 1; i < poly2.length; j = i++) {
      const a = poly2[i]!, b = poly2[j]!;
      if (a[1] > q[1] !== b[1] > q[1] && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  };
  const runs: Point[][] = [];
  let cur: Point[] = [];
  pts.forEach((q, i) => {
    const hid = outlines.some((o, k) => behind(i, k) && inside(q, o));
    if (hid) { if (cur.length > 1) runs.push(cur); cur = []; } else cur.push(q);
  });
  if (cur.length > 1) runs.push(cur);
  return runs;
}

/** The course: a gate of two pole buoys ahead of the boat, then a ball buoy. */
const COURSE = { gate: 1.95, half: 0.56, ball: [3.05, 0.62, 0.06] as V3 };
const AZ = 62, EL = 36;

/** Inside an ellipse on the water, for trimming the wave rows to a patch round the scene. */
const patch = (cx: number, cy: number, rx: number, ry: number, ang = 0) => (q: V3) => {
  const c = Math.cos(rd(ang)), s = Math.sin(rd(ang)), dx = q[0] - cx, dy = q[1] - cy;
  const u = dx * c + dy * s, v = -dx * s + dy * c;
  return (u * u) / (rx * rx) + (v * v) / (ry * ry) < 1;
};

export function boat(uid: string): string {
  // The boat from behind and above, its camera framing the gate ahead; the path
  // runs through the gate and on past the ball buoy.
  const p = new Pen(uid);
  const eye: V3 = [0.305, 0, 0.62], G = COURSE.gate, B = COURSE.ball;
  // The camera's frame: a pyramid from the lens to a window round the gate.
  const win: V3[] = [[G, 0.82, 0.78], [G, -0.82, 0.78], [G, -0.82, 0], [G, 0.82, 0]];
  const pts: V3[] = [[-0.85, -0.42, 0], [-0.85, 0.42, 0], [0.75, -0.42, 0], [0.75, 0.42, 0], [-0.48, 0.25, 0.47], eye, ...win, [3.75, 0.9, 0], [3.05, 0.85, 0.25], [3.3, 0.3, 0]];
  const cam = fit(AZ, EL, pts, 34, 70, 566, 530);
  waterRows(p, cam, [1.5, 0.15, 0], 17, 0.26, 3.6, 0.028, 11, 0.5, patch(1.5, 0.2, 2.8, 1.5, 12));
  p.B(win.map((q) => seg3(cam, eye, q)).join(''), 0.6);
  p.B(path3(cam, win, true), 0.85);
  type Buoy = { at: V3; draw: () => Point[] };
  const buoys: Buoy[] = [
    ...[-1, 1].map((s): Buoy => { const c: V3 = [G, s * COURSE.half, 0]; return { at: [c[0], c[1], 0.3], draw: () => { ripples(p, cam, c, 0.085); return pole(p, cam, c, 0.085, 0.42, 0.15); } }; }),
    { at: B, draw: () => { ripples(p, cam, B, 0.15); return ball(p, cam, B, 0.16); } },
  ].sort((m, n) => cam.depth(m.at) - cam.depth(n.at));
  const outlines = buoys.map((b) => b.draw());
  vessel(p, cam, [0, 0, 0], 0);
  // Through the gate, then left, passing the ball buoy on its near side.
  const path = bez3([0.95, 0, 0], [1.4, 0, 0], [1.9, 0, 0], [2.35, 0.04, 0])
    .concat(bez3([2.35, 0.04, 0], [2.8, 0.09, 0], [2.9, 0.28, 0], [3.25, 0.34, 0]).slice(1))
    .concat(bez3([3.25, 0.34, 0], [3.55, 0.39, 0], [3.7, 0.6, 0], [3.72, 0.85, 0]).slice(1));
  const runs = unhidden(path.map(cam.P), (i, k) => cam.depth(path[i]!) < cam.depth(buoys[k]!.at), outlines);
  for (const r of runs) p.T(poly(r));
  p.F(poly(path.map(cam.P)), 6, 0);
  outlines.forEach((o, k) => { if (buoys[k]!.at[0] < 2.5) brackets(p, o, 6); });
  p.accent(cam.P(add3(eye, [1, 0, 0], 0.035)), 3.2);
  return p.svg('boat');
}
