// RobIn Lab: a Franka carries a glass of water past an open laptop and pours
// it into a mug in front of it (the OopsieVerse pour task), seen from three
// quarters with the whole table in frame. Metres: x right along the table, y
// away from its front edge, z up.
import { poly, dashedPoly, rd } from './geom';
import { Pen } from './pen';
import { type V3, type Cam, add3, scale3, cross3, dot3, norm3, fit, cyl, box3, ring, path3, hull, bez3 } from './d3';
import { pose3, hand3, reach3, franka3 } from './franka3';

const BASE: V3 = [-0.14, 0.13, 0];
const LAP = { x: 0.3, y: 0.2, w: 0.34, d: 0.23, t: 0.018, sh: 0.22, lean: 15 };
const GLASS = { r: 0.038, h: 0.125 };
const MUG = { r: 0.05, h: 0.1 };
const START: V3 = [0.1, -0.1, 0];
const TABLE = { x0: -0.35, x1: 0.78, y0: -0.25, y1: 0.56, t: 0.03 };
const HAND: V3 = [0.46, -0.03, 0.26];
const ROLL = 60;

/** An open glass of water from c along g: its walls, its mouth, and the level water. */
function glass(p: Pen, cam: Cam, c: V3, g: V3) {
  const { facingTop } = cyl(p, cam, c, g, GLASS.r, GLASS.h);
  const rim = ring(add3(c, g, GLASS.h), g, GLASS.r);
  if (!facingTop) p.B(path3(cam, rim, true), 0.7);
  const zl = Math.min(...rim.map((q) => q[2])) - 0.003;
  const t0: V3 = Math.abs(g[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], e1 = norm3(cross3(g, t0)), e2 = cross3(g, e1);
  const pts: V3[] = [];
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * Math.PI * 2, off = add3(scale3(e1, GLASS.r * 0.97 * Math.cos(t)), e2, GLASS.r * 0.97 * Math.sin(t));
    const s = (zl - c[2] - off[2]) / g[2];
    if (s >= 0 && s <= GLASS.h) pts.push(add3(add3(c, g, s), off));
  }
  if (pts.length > 2) p.B(path3(cam, pts), 0.8);
}

/** The pour: from the lowest point of the rim, falling to the mug's water. */
function stream(gc: V3, g: V3): V3[] {
  const rim = ring(add3(gc, g, GLASS.h / 2), g, GLASS.r, 96);
  const lip = rim.reduce((a, b) => (b[2] < a[2] ? b : a)), hv = norm3([g[0], g[1], 0]), zEnd = MUG.h - 0.025;
  const T = Math.sqrt((2 * (lip[2] - zEnd)) / 9.81), out: V3[] = [];
  for (let i = 0; i <= 24; i++) { const t = (i / 24) * T; out.push(add3(add3(lip, hv, 0.3 * t), [0, 0, -0.5 * 9.81 * t * t])); }
  return out;
}

export function pour(uid: string): string {
  const p = new Pen(uid);
  const arm = pose3(BASE, HAND, -6), roll = rd(ROLL), { gc, g } = hand3(arm, roll);
  const st = stream(gc, g), land = st[st.length - 1]!, MC: V3 = [land[0] - 0.006, land[1] - 0.004, 0];
  const scr: V3[] = [[LAP.x, LAP.y + LAP.d, 0], [LAP.x + LAP.w, LAP.y + LAP.d + 0.06, LAP.sh]];
  // The whole table, edges and all, with the arm and the screen. The camera
  // stands 35 degrees round from straight on and looks 26 degrees down.
  const pts: V3[] = [];
  for (const x of [TABLE.x0, TABLE.x1]) for (const y of [TABLE.y0, TABLE.y1]) for (const z of [0, -TABLE.t]) pts.push([x, y, z]);
  pts.push(...scr, ...reach3(arm));
  const cam = fit(-35, 26, pts, 40, 40, 560, 560);

  box3(p, cam, [TABLE.x0, TABLE.y0, -TABLE.t], [TABLE.x1 - TABLE.x0, 0, 0], [0, TABLE.y1 - TABLE.y0, 0], [0, 0, TABLE.t]);
  // The margin around the laptop that has to stay dry.
  {
    const m = 0.04, x0 = LAP.x - m, x1 = LAP.x + LAP.w + m, y0 = LAP.y - m, y1 = LAP.y + LAP.d + 0.07, rr = 0.03, q: V3[] = [];
    const arc = (cx: number, cy: number, a0: number) => { for (let i = 0; i <= 8; i++) { const a = rd(a0 + (i / 8) * 90); q.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a), 0]); } };
    arc(x1 - rr, y0 + rr, 270); arc(x1 - rr, y1 - rr, 0); arc(x0 + rr, y1 - rr, 90); arc(x0 + rr, y0 + rr, 180);
    q.push(q[0]!);
    p.B(dashedPoly(q.map(cam.P), 5, 5), 0.9);
  }
  // The laptop: deck, keys, trackpad, and the screen leaning back.
  const deck = box3(p, cam, [LAP.x, LAP.y, 0], [LAP.w, 0, 0], [0, LAP.d, 0], [0, 0, LAP.t]);
  const T = (u: number, w: number): V3 => deck.c(u, w, 1);
  let keys = '';
  for (let r = 0; r < 5; r++) {
    const w0 = 0.47 + r * 0.088, w1 = w0 + 0.062;
    for (let u = 0.075; u < 0.9; u += 0.0645) keys += path3(cam, [T(u, w0), T(u + 0.048, w0), T(u + 0.048, w1), T(u, w1)], true);
  }
  p.B(keys, 0.45);
  p.B(path3(cam, [T(0.36, 0.07), T(0.64, 0.07), T(0.64, 0.36), T(0.36, 0.36)], true), 0.6);
  const su: V3 = [0, Math.sin(rd(LAP.lean)), Math.cos(rd(LAP.lean))], sb: V3 = [0, Math.cos(rd(LAP.lean)), -Math.sin(rd(LAP.lean))];
  const sc = box3(p, cam, [LAP.x, LAP.y + LAP.d - 0.004, LAP.t * 0.7], [LAP.w, 0, 0], scale3(sb, 0.01), scale3(su, LAP.sh));
  if (dot3(scale3(sb, -1), cam.C) > 0.05) p.B(path3(cam, [sc.c(0.04, 0, 0.07), sc.c(0.96, 0, 0.07), sc.c(0.96, 0, 0.94), sc.c(0.04, 0, 0.94)], true), 0.6);
  // Where the glass stood.
  const s0: V3 = add3(START, [0, 0, GLASS.h / 2]);
  const gh = hull([...ring(START, [0, 0, 1], GLASS.r), ...ring(add3(START, [0, 0, GLASS.h]), [0, 0, 1], GLASS.r)].map(cam.P));
  p.B(dashedPoly([...gh, gh[0]!], 4, 5), 0.9);
  // The mug, its handle to the right.
  const handle = () => {
    const hc = add3(MC, [MUG.r - 0.004, 0, MUG.h * 0.52]), out: V3[] = [], inn: V3[] = [];
    for (let i = 0; i <= 20; i++) { const a = rd(-80 + i * 8); out.push(add3(hc, [0.032 * Math.cos(a), 0, 0.034 * Math.sin(a)])); inn.push(add3(hc, [0.018 * Math.cos(a), 0, 0.021 * Math.sin(a)])); }
    p.Fill(path3(cam, [...out, ...inn.reverse()], true));
  };
  const front = cam.depth(add3(MC, [0.06, 0, 0])) > cam.depth(MC);
  if (!front) handle();
  cyl(p, cam, MC, [0, 0, 1], MUG.r, MUG.h);
  p.B(path3(cam, ring(add3(MC, [0, 0, MUG.h]), [0, 0, 1], MUG.r - 0.006), true), 0.7);
  if (front) handle();
  franka3(p, cam, arm, { roll, gap: GLASS.r, hold: { at: gc, draw: () => glass(p, cam, add3(gc, g, -GLASS.h / 2), g) } });
  // The safe path: up, out in front of the laptop, and over to the mug.
  const good = bez3(s0, [0.12, 0.02, 0.34], [0.26, -0.08, 0.32], gc, 80);
  const gd = poly(good.map(cam.P));
  p.B(gd);
  p.T(gd);
  p.F(gd, 5, 0);
  p.accent(cam.P(s0), 3.4);
  const sd = poly(st.map(cam.P));
  p.B(sd);
  p.T(sd);
  p.F(sd, 1.6, 0);
  p.F(sd, 1.6, 0.8);
  return p.svg('pour');
}
