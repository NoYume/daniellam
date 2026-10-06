// Texas Robotics: a vision-language-action model. The camera's view and the
// instruction feed a three-layer network, drawn flat, which drives a Franka
// in 3D on a table that grasps the cup it saw.
import { type Point, circ, L, f, rrect, cubic, hcurve } from './geom';
import { Pen } from './pen';
import { type V3, type Cam, add3, fit, cyl, box3, ring, path3 } from './d3';
import { pose3, hand3, reach3, franka3 } from './franka3';

/** Corner brackets around a camera's view, a faint patch grid, and the cup it sees. */
function view(p: Pen, x: number, y: number, w: number, h: number) {
  const k = Math.min(w, h) * 0.16;
  p.B(`M${x},${y + k} L${x},${y} L${x + k},${y} M${x + w - k},${y} L${x + w},${y} L${x + w},${y + k} M${x + w},${y + h - k} L${x + w},${y + h} L${x + w - k},${y + h} M${x + k},${y + h} L${x},${y + h} L${x},${y + h - k}`, 1.2);
  let g = '';
  for (let i = 1; i < 4; i++) g += L([x + (w * i) / 4, y + 8], [x + (w * i) / 4, y + h - 8]);
  for (let j = 1; j < 3; j++) g += L([x + 8, y + (h * j) / 3], [x + w - 8, y + (h * j) / 3]);
  p.B(g, 0.35);
  const ty = y + h * 0.78;
  p.B(L([x + w * 0.1, ty], [x + w * 0.9, ty]));
  cup2(p, x + w * 0.56, ty, w * 0.15, h * 0.3);
}
function cup2(p: Pen, cx: number, base: number, w: number, h: number) {
  p.Fill(rrect(cx - w / 2, base - h, w, h, Math.min(5, w / 5)));
  p.B(`M${f(cx + w / 2)},${f(base - h * 0.78)} C${f(cx + w / 2 + w * 0.45)},${f(base - h * 0.78)} ${f(cx + w / 2 + w * 0.45)},${f(base - h * 0.3)} ${f(cx + w / 2)},${f(base - h * 0.3)}`);
}
/** A speech bubble holding the instruction as a row of word tokens. */
function bubble(p: Pen, x: number, y: number, w: number, h: number, widths: number[]) {
  const r = h / 2.6;
  p.Fill(`M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + 34} L${x + 14},${y + h + 14} L${x + 20},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`);
  const tw = widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * 7;
  let tx = x + (w - tw) / 2;
  for (const wd of widths) { p.B(rrect(tx, y + h / 2 - 8, wd, 16, 8)); tx += wd + 7; }
}
/** The network: layers of units, every unit linked to every unit of the next. */
function network(p: Pen, xs: number[], ys: number[], r: number) {
  let e = '';
  for (let c = 0; c < xs.length - 1; c++) for (const a of ys) for (const b of ys) e += L([xs[c]!, a], [xs[c + 1]!, b]);
  p.B(e, 0.3);
  for (const x of xs) for (const y of ys) p.Fill(circ(x, y, r));
}
/** The left half: the view and the instruction into the network. Returns the routes to light. */
function inputs(p: Pen) {
  view(p, 22, 138, 152, 114);
  bubble(p, 22, 330, 152, 56, [28, 20, 24, 32]);
  const xs = [212, 260, 308], ys = [190, 240, 290, 340, 390];
  const inV = hcurve([178, 196], [xs[0]!, 240], 0.55), inL = hcurve([178, 358], [xs[0]!, 340], 0.55);
  p.B(inV + inL);
  network(p, xs, ys, 9);
  const route = inV + ' L' + xs[1] + ',290 L' + xs[2] + ',290';
  const route2 = inL + ' L' + xs[1] + ',290';
  return { out: [xs[2]!, 290] as Point, lit: [[xs[0]!, 240], [xs[0]!, 340], [xs[1]!, 290], [xs[2]!, 290]] as Point[], route, route2 };
}
/** Lights the routes: from the view through the network and out to the hand, and from the instruction. */
function light(p: Pen, io: ReturnType<typeof inputs>, out: string) {
  const full = io.route + ' ' + out.replace('M', 'L');
  p.T(full);
  p.F(full, 5.5, 0);
  p.T(io.route2);
  p.F(io.route2, 5.5, 2.6);
  for (const q of io.lit) p.accent(q, 3.6);
}

/**
 * A small table scene in 3D: the Franka at the back reaching forward for the cup,
 * fitted into a box on the page. Returns where the hand is on the page.
 */
function frankaScene(p: Pen, box: [number, number, number, number], az: number, el: number) {
  const T = { x0: -0.12, x1: 0.66, y0: -0.24, y1: 0.3, t: 0.03 };
  const base: V3 = [0.46, 0.14, 0], CUP = { c: [0.02, -0.12, 0] as V3, r: 0.04, h: 0.1 };
  const cc: V3 = add3(CUP.c, [0, 0, CUP.h * 0.55]);
  // The hand comes in level, its fingers either side of the cup.
  const d = [cc[0] - base[0], cc[1] - base[1]], l = Math.hypot(d[0]!, d[1]!);
  const H: V3 = [cc[0] - (d[0]! / l) * 0.08, cc[1] - (d[1]! / l) * 0.08, cc[2]];
  const arm = pose3(base, H, 0);
  const pts: V3[] = [];
  for (const x of [T.x0, T.x1]) for (const y of [T.y0, T.y1]) for (const z of [0, -T.t]) pts.push([x, y, z]);
  pts.push(...reach3(arm));
  const cam: Cam = fit(az, el, pts, box[0], box[1], box[2], box[3]);
  box3(p, cam, [T.x0, T.y0, -T.t], [T.x1 - T.x0, 0, 0], [0, T.y1 - T.y0, 0], [0, 0, T.t]);
  const cupDraw = () => {
    cyl(p, cam, CUP.c, [0, 0, 1], CUP.r, CUP.h);
    p.B(path3(cam, ring(add3(CUP.c, [0, 0, CUP.h]), [0, 0, 1], CUP.r - 0.006), true), 0.7);
  };
  franka3(p, cam, arm, { roll: 0, gap: CUP.r + 0.004, hold: { at: cc, draw: cupDraw } });
  return { hand: cam.P(hand3(arm, 0).H) };
}

export function vla(uid: string): string {
  // The diagram stays flat; the arm it drives is drawn in 3D, as in the RobIn Lab pour.
  const p = new Pen(uid);
  const io = inputs(p);
  const { hand } = frankaScene(p, [328, 96, 596, 520], -35, 26);
  const out = cubic(io.out, [356, 290], [hand[0] - 60, hand[1] - 90], [hand[0] - 4, hand[1] - 16]);
  p.B(out);
  light(p, io, out);
  return p.svg('vla');
}
