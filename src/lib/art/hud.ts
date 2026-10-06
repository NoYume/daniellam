// Lockheed Martin: the fighter HUD's symbols banked over wireframe terrain,
// hidden lines removed.
import { type Point, circ, L, poly, dashed, arcPts, rd } from './geom';
import { Pen } from './pen';

/** Rotate p about c by a radians. */
const rot = (p: Point, c: Point, a: number): Point => {
  const s = Math.sin(a), k = Math.cos(a), x = p[0] - c[0], y = p[1] - c[1];
  return [c[0] + x * k - y * s, c[1] + x * s + y * k];
};
/** A smooth hill of height h centred at (x0, z0). */
const gs = (x: number, z: number, x0: number, z0: number, sx: number, sz: number, h: number) => h * Math.exp(-((x - x0) ** 2 / sx + (z - z0) ** 2 / sz));

/** Terrain rows with hidden lines removed, returned as polylines (screen space, before any bank). */
function terrainLines(hill: (x: number, z: number) => number, cam: { h: number; fx: number; fy: number; hy: number }, rows: number, z0: number, z1: number) {
  const proj = (x: number, y: number, z: number): Point => [300 + (x / z) * cam.fx, cam.hy + ((cam.h - y) / z) * cam.fy];
  const minY = new Float64Array(601).fill(1e9);
  const out: { segs: Point[][]; r: number }[] = [];
  for (let r = 0; r < rows; r++) {
    const z = z0 * Math.pow(z1 / z0, r / (rows - 1)), half = (330 / cam.fx) * z;
    const pts: Point[] = [];
    for (let i = 0; i <= 260; i++) { const x = -half + (2 * half * i) / 260; pts.push(proj(x, hill(x, z), z)); }
    const segs: Point[][] = [];
    let seg: Point[] = [];
    pts.forEach((q) => { const xi = Math.round(q[0]); const vis = (xi < 0 || xi > 600 || q[1] < minY[xi] - 0.5) && q[1] < 640; if (vis) seg.push(q); else { if (seg.length > 1) segs.push(seg); seg = []; } });
    if (seg.length > 1) segs.push(seg);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      for (let xi = Math.max(0, Math.ceil(Math.min(a[0], b[0]))); xi <= Math.min(600, Math.floor(Math.max(a[0], b[0]))); xi++) {
        const t = (xi - a[0]) / (b[0] - a[0] || 1), y = a[1] + (b[1] - a[1]) * t;
        if (y < minY[xi]) minY[xi] = y;
      }
    }
    out.push({ segs, r });
  }
  return out;
}

/** The fighter HUD's symbols, banked about the centre. */
function hudSymbols(p: Pen, opt: { bank: number; horizonY: number; target: Point }) {
  const c: Point = [300, 300], bank = opt.bank, pitchPx = 10.4, horizonY = opt.horizonY;
  const R = (q: Point) => rot(q, c, bank);
  // Pitch ladder, and the horizon.
  for (const deg of [-10, -5, 5, 10, 15]) {
    const y = horizonY - deg * pitchPx, tick = deg > 0 ? 9 : -9;
    const seg = (x0: number, x1: number, tx: number) => {
      const a = R([300 + x0, y]), b = R([300 + x1, y]), t = R([300 + tx, y + tick]);
      return { line: deg > 0 ? L(a, b) : dashed(a, b, 7, 5), tick: L(R([300 + tx, y]), t) };
    };
    const l = seg(-118, -42, -42), r = seg(42, 118, 42);
    p.B(l.line + r.line + l.tick + r.tick);
  }
  const hz = L(R([50, horizonY]), R([254, horizonY])) + L(R([346, horizonY]), R([550, horizonY]));
  p.B(hz);
  p.T(hz);
  p.F(L(R([50, horizonY]), R([550, horizonY])), 5.5, 0, true);
  // Flight path marker.
  const m: Point = [308, horizonY - 14];
  p.T(circ(m[0], m[1], 9) + L([m[0] - 9, m[1]], [m[0] - 25, m[1]]) + L([m[0] + 9, m[1]], [m[0] + 25, m[1]]) + L([m[0], m[1] - 9], [m[0], m[1] - 19]));
  p.accent(m, 2.6);
  // Boresight cross.
  p.B(L([300, 132], [300, 142]) + L([300, 150], [300, 160]) + L([286, 146], [296, 146]) + L([304, 146], [314, 146]));
  // Heading tape, top.
  let ht = L([196, 70], [404, 70]);
  for (let i = 0, x = 196; x <= 404; i++, x += 13) ht += L([x, 70], [x, 70 + (i % 4 === 0 ? 13 : 6)]);
  p.B(ht + poly([[300, 92], [294, 102], [306, 102]], true));
  // Airspeed (left) and altitude (right) tapes.
  const tape = (x: number, dir: number) => {
    let d = L([x, 196], [x, 404]);
    for (let i = 0, y = 196; y <= 404; i++, y += 13) d += L([x, y], [x + dir * (i % 4 === 0 ? 13 : 6), y]);
    const bx = x - dir * 10;
    return d + poly([[bx, 300], [bx - dir * 8, 290], [bx - dir * 50, 290], [bx - dir * 50, 310], [bx - dir * 8, 310]], true);
  };
  p.Fill(tape(96, 1)); p.Fill(tape(504, -1));
  // Bank scale, bottom.
  let bs = poly(arcPts(c, 214, rd(90 - 46), rd(90 + 46), 40));
  for (const a of [-45, -30, -20, -10, 0, 10, 20, 30, 45]) {
    const ang = rd(90 + a), len = a % 30 === 0 || Math.abs(a) === 45 ? 14 : 8;
    bs += L([c[0] + 214 * Math.cos(ang), c[1] + 214 * Math.sin(ang)], [c[0] + (214 + len) * Math.cos(ang), c[1] + (214 + len) * Math.sin(ang)]);
  }
  p.B(bs);
  // Target box and its cue line.
  const tb = opt.target;
  p.Fill(poly([[tb[0] - 14, tb[1] - 14], [tb[0] + 14, tb[1] - 14], [tb[0] + 14, tb[1] + 14], [tb[0] - 14, tb[1] + 14]], true));
  p.B(dashed([m[0] + 14, m[1] - 10], [tb[0] - 16, tb[1] + 12], 4, 6));
  p.accent(tb, 3);
}

export function hud(uid: string): string {
  // The fighter HUD over the terrain ahead, both banked together, the way a
  // simulator (or synthetic vision) draws the world behind the symbols.
  const p = new Pen(uid);
  const bank = rd(-7), horizonY = 300 + 2 * 10.4, c: Point = [300, 300];
  const hill = (x: number, z: number) =>
    gs(x, z, -2.4, 7, 1.6, 3.2, 1.9) + gs(x, z, 2.6, 8.5, 2.0, 3.6, 2.3) + gs(x, z, 0.2, 13, 3.4, 6, 2.4) + gs(x, z, 1.0, 4.4, 0.32, 0.9, 0.42) +
    0.05 * Math.sin(x * 2.7 + z * 1.1) + 0.035 * Math.sin(x * 4.9 - z * 1.9);
  const rows = terrainLines(hill, { h: 1.1, fx: 330, fy: 300, hy: horizonY }, 28, 0.95, 18);
  for (const { segs, r } of rows) {
    const d = segs.map((s) => poly(s.map((q) => rot(q, c, bank)))).join(' ');
    if (d) p.B(d, 0.75 - (r / 28) * 0.4);
  }
  hudSymbols(p, { bank, horizonY, target: [430, 214] });
  return p.svg('hud');
}
