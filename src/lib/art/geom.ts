// 2D geometry helpers for the line drawings: points, lines, polylines, curves,
// arcs, dashes and rounded rectangles.
export type Point = [number, number];
export const f = (n: number) => n.toFixed(1);
export const rd = (d: number) => (d * Math.PI) / 180;

export function circ(cx: number, cy: number, r: number): string {
  return 'M' + f(cx - r) + ',' + f(cy) + ' a' + r + ',' + r + ' 0 1,0 ' + 2 * r + ',0 a' + r + ',' + r + ' 0 1,0 ' + -2 * r + ',0';
}
export function L(a: Point, b: Point): string { return 'M' + f(a[0]) + ',' + f(a[1]) + ' L' + f(b[0]) + ',' + f(b[1]) + ' '; }
export function poly(ps: Point[], close = false): string { return 'M' + ps.map((p) => f(p[0]) + ',' + f(p[1])).join(' L') + (close ? ' Z' : ''); }
export function cubic(p0: Point, p1: Point, p2: Point, p3: Point): string {
  return 'M' + f(p0[0]) + ',' + f(p0[1]) + ' C' + f(p1[0]) + ',' + f(p1[1]) + ' ' + f(p2[0]) + ',' + f(p2[1]) + ' ' + f(p3[0]) + ',' + f(p3[1]);
}
/** A horizontal S-curve from a to b, as node-graph edges are drawn. */
export function hcurve(a: Point, b: Point, k = 0.5): string {
  const dx = (b[0] - a[0]) * k;
  return cubic(a, [a[0] + dx, a[1]], [b[0] - dx, b[1]], b);
}
function track(pts: Point[]) {
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = s[s.length - 1];
  return {
    total,
    at(len: number): { p: Point; t: Point; n: Point } {
      const l = Math.max(0, Math.min(total, len));
      let i = 1;
      while (i < s.length - 1 && s[i] < l) i++;
      const a = pts[i - 1], b = pts[i], k = (l - s[i - 1]) / (s[i] - s[i - 1] || 1);
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
      return { p: [a[0] + dx * k, a[1] + dy * k], t: [dx / d, dy / d], n: [-dy / d, dx / d] };
    },
  };
}
export function dashed(a: Point, b: Point, on = 7, off = 6): string {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
  let d = '';
  for (let s = 0; s < len; s += on + off) {
    const e = Math.min(len, s + on);
    d += L([a[0] + ux * s, a[1] + uy * s], [a[0] + ux * e, a[1] + uy * e]);
  }
  return d;
}
export function arcPts(c: Point, r: number, a0: number, a1: number, n = 48): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  return out;
}
/** A dashed version of any polyline. */
export function dashedPoly(pts: Point[], on = 7, off = 6): string {
  const tr = track(pts);
  let d = '';
  for (let s = 0; s < tr.total; s += on + off) {
    const seg: Point[] = [];
    const e = Math.min(tr.total, s + on);
    for (let u = s; u < e; u += 2) seg.push(tr.at(u).p);
    seg.push(tr.at(e).p);
    d += poly(seg) + ' ';
  }
  return d;
}
export function rrect(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.min(r, w / 2, h / 2);
  return `M${f(x + r)},${f(y)} H${f(x + w - r)} A${r},${r} 0 0 1 ${f(x + w)},${f(y + r)} V${f(y + h - r)} A${r},${r} 0 0 1 ${f(x + w - r)},${f(y + h)} H${f(x + r)} A${r},${r} 0 0 1 ${f(x)},${f(y + h - r)} V${f(y + r)} A${r},${r} 0 0 1 ${f(x + r)},${f(y)} Z`;
}
