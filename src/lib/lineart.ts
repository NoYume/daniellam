// The six line drawings, ported from the round 6 prototype's makeArt and
// built as SVG markup at build time. Every number is the prototype's.
import { mulberry32 } from '../../scripts/lib/random';
import type { LineArtKey } from './lineart-keys';

type Point = [number, number];

const W = 600;
const H = 600;

/** Blues through white, in user space: bounding-box gradients don't render on straight lines. */
function grad(id: string, rev: boolean): string {
  const stops = ['var(--g1)', 'var(--g2)', 'var(--g3)'];
  if (rev) stops.reverse();
  return (
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${H}">` +
    stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" style="stop-color:${c}"/>`).join('') +
    '</linearGradient>'
  );
}

function circ(cx: number, cy: number, r: number): string {
  return 'M' + (cx - r) + ',' + cy + ' a' + r + ',' + r + ' 0 1,0 ' + 2 * r + ',0 a' + r + ',' + r + ' 0 1,0 ' + -2 * r + ',0';
}

function rot(p: Point, c: Point, a: number): Point {
  const s = Math.sin(a), k = Math.cos(a), x = p[0] - c[0], y = p[1] - c[1];
  return [c[0] + x * k - y * s, c[1] + x * s + y * k];
}

function L(a: Point, b: Point): string {
  return 'M' + a[0].toFixed(1) + ',' + a[1].toFixed(1) + ' L' + b[0].toFixed(1) + ',' + b[1].toFixed(1) + ' ';
}

/** Full <svg> markup for one drawing. `uid` keeps gradient ids unique when a drawing appears twice. */
export function lineArt(key: LineArtKey, uid: string): string {
  const id = `${uid}-g`, idr = `${uid}-gr`;
  let viewBox = `0 0 ${W} ${H}`;
  let base = '', flow = '', dots = '';
  const B = (d: string) => {
    base += '<path class="la-base" d="' + d + '"/>';
  };
  const F = (d: string, dur?: number, delay?: number, rev?: boolean) => {
    flow += '<path class="la-flow" stroke="url(#' + (rev ? idr : id) + ')" style="animation-duration:' + (dur || 7) + 's;animation-delay:-' + (delay || 0) + 's" d="' + d + '"/>';
  };
  const T = (d: string, rev?: boolean) => {
    flow += '<path class="la-tint" stroke="url(#' + (rev ? idr : id) + ')" d="' + d + '"/>';
  };

  if (key === 'voice') {
    for (let i = 0; i < 13; i++) {
      let d = '';
      for (let x = 0; x <= W; x += 5) {
        const env = Math.exp(-Math.pow((x - 300) / 165, 2));
        const y = 300 + (i - 6) * 9 + Math.sin(x * 0.043 + i * 0.5) * env * (110 - Math.abs(i - 6) * 12) + Math.sin(x * 0.12 + i * 1.3) * env * 16;
        d += (x === 0 ? 'M' : 'L') + x + ',' + y.toFixed(1) + ' ';
      }
      B(d);
      if (i % 4 === 1) F(d, 6 + i * 0.35, i * 0.8, i % 8 === 1);
      if (i === 6) T(d);
    }
    for (let x = 60; x <= 540; x += 24) {
      const h = 6 + 34 * Math.exp(-Math.pow((x - 300) / 140, 2)) * (0.6 + 0.4 * Math.sin(x));
      B('M' + x + ',' + (520 - h) + ' L' + x + ',' + (520 + h));
    }
  }

  if (key === 'hud') {
    const c: Point = [300, 300], tilt = -0.14;
    [78, 150, 222].forEach((r, k) => {
      B(circ(300, 300, r));
      if (k === 1) F(circ(300, 300, r), 9, 2);
    });
    let d = '';
    for (let a = 0; a < 360; a += 10) {
      const rr = a % 30 === 0 ? 242 : 232, ang = (a * Math.PI) / 180;
      d += L([300 + 222 * Math.cos(ang), 300 + 222 * Math.sin(ang)], [300 + rr * Math.cos(ang), 300 + rr * Math.sin(ang)]);
    }
    B(d);
    for (let kk = -3; kk <= 3; kk++) {
      if (kk === 0) continue;
      const yy = 300 + kk * 46;
      let seg = L(rot([190, yy], c, tilt), rot([268, yy], c, tilt)) + L(rot([332, yy], c, tilt), rot([410, yy], c, tilt));
      seg += L(rot([190, yy], c, tilt), rot([190, yy + (kk < 0 ? 10 : -10)], c, tilt)) + L(rot([410, yy], c, tilt), rot([410, yy + (kk < 0 ? 10 : -10)], c, tilt));
      B(seg);
      if (kk === -1) F(seg, 6, 1);
    }
    const hz = L(rot([20, 300], c, tilt), rot([580, 300], c, tilt));
    B(hz);
    F(hz, 5.5, 0, true);
    T(hz);
    B(circ(300, 300, 11) + L([272, 300], [289, 300]) + L([311, 300], [328, 300]) + L([300, 289], [300, 276]));
    B(L([300, 40], [300, 70]) + L([300, 530], [300, 560]));
  }

  if (key === 'arm') {
    const j0: Point = [300, 452], j1: Point = [222, 300], j2: Point = [372, 196], ee: Point = [468, 252];
    B('M150,520 L450,520 M196,520 L218,476 L382,476 L404,520');
    const link = (a: Point, b: Point, w: number) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), nx = (-dy / len) * w, ny = (dx / len) * w;
      return L([a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny]) + L([a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny]);
    };
    B(link(j0, j1, 13) + link(j1, j2, 11) + link(j2, ee, 8));
    B(circ(j0[0], j0[1], 20) + circ(j1[0], j1[1], 16) + circ(j2[0], j2[1], 12) + circ(j0[0], j0[1], 7) + circ(j1[0], j1[1], 5));
    B(L(ee, [498, 270]) + L([498, 270], [516, 254]) + L(ee, [486, 222]) + L([486, 222], [506, 210]));
    const traj = 'M120,250 C170,90 360,40 470,110 S560,300 520,380';
    B(traj);
    F(traj, 6.5, 0);
    T(traj, true);
    for (const p of [[120, 250], [250, 98], [470, 110], [548, 250]]) dots += '<circle class="la-dot" cx="' + p[0] + '" cy="' + p[1] + '" r="3.5"/>';
    flow +=
      '<path d="' + L(ee, [ee[0] + 44, ee[1]]) + '" style="stroke:var(--g1)" stroke-width="2" fill="none"/>' +
      '<path d="' + L(ee, [ee[0], ee[1] - 44]) + '" style="stroke:var(--g2)" stroke-width="2" fill="none"/>' +
      '<path d="' + L(ee, [ee[0] - 26, ee[1] + 26]) + '" style="stroke:var(--g3)" stroke-width="2" fill="none"/>';
  }

  if (key === 'tree') {
    // An RRT growing from the start (bottom left), with the path to the goal lit.
    const rnd = mulberry32(11), nodes: Point[] = [[110, 490]], parent = [-1];
    let edges = '';
    for (let i = 0; i < 90; i++) {
      const p: Point = [50 + rnd() * 500, 50 + rnd() * 500];
      let best = 0, bd = 1e12;
      for (let j = 0; j < nodes.length; j++) {
        const dd = Math.pow(nodes[j][0] - p[0], 2) + Math.pow(nodes[j][1] - p[1], 2);
        if (dd < bd) {
          bd = dd;
          best = j;
        }
      }
      const dist = Math.sqrt(bd), stp = Math.min(46, dist), n = nodes[best];
      const q: Point = [n[0] + ((p[0] - n[0]) / dist) * stp, n[1] + ((p[1] - n[1]) / dist) * stp];
      nodes.push(q);
      parent.push(best);
      edges += L(n, q);
    }
    B(edges);
    for (const nd of nodes) dots += '<circle class="la-dot" cx="' + nd[0].toFixed(1) + '" cy="' + nd[1].toFixed(1) + '" r="2.6"/>';
    const goal: Point = [500, 110];
    let gi = 0, gd = 1e12;
    nodes.forEach((nd, k) => {
      const dd = Math.pow(nd[0] - goal[0], 2) + Math.pow(nd[1] - goal[1], 2);
      if (dd < gd) {
        gd = dd;
        gi = k;
      }
    });
    const path: Point[] = [];
    for (let cur = gi; cur !== -1; cur = parent[cur]) path.push(nodes[cur]);
    path.reverse();
    const pd = 'M' + path.map((pt) => pt[0].toFixed(1) + ',' + pt[1].toFixed(1)).join(' L');
    F(pd, 5, 0);
    T(pd);
    B(circ(goal[0], goal[1], 16));
    dots += '<circle cx="110" cy="490" r="6" style="fill:var(--g2)"/>';
  }

  if (key === 'building') {
    const s = 34, w = 5, dpt = 4, ht = 8;
    const iso = (px: number, py: number, pz: number): Point => [300 + (px - py) * 0.866 * s, 400 + (px + py) * 0.5 * s - pz * s];
    B(L(iso(0, 0, 0), iso(w, 0, 0)) + L(iso(w, 0, 0), iso(w, dpt, 0)) + L(iso(0, 0, 0), iso(0, dpt, 0)) + L(iso(0, dpt, 0), iso(w, dpt, 0)));
    B(L(iso(0, dpt, 0), iso(0, dpt, ht)) + L(iso(w, dpt, 0), iso(w, dpt, ht)) + L(iso(w, 0, 0), iso(w, 0, ht)));
    B(L(iso(0, dpt, ht), iso(w, dpt, ht)) + L(iso(w, dpt, ht), iso(w, 0, ht)) + L(iso(w, 0, ht), iso(0, 0, ht)) + L(iso(0, 0, ht), iso(0, dpt, ht)));
    for (let z = 1; z < ht; z++) B(L(iso(0, dpt, z), iso(w, dpt, z)) + L(iso(w, dpt, z), iso(w, 0, z)));
    for (let x = 1; x < w; x++) B(L(iso(x, dpt, 0), iso(x, dpt, ht)));
    for (let yv = 1; yv < dpt; yv++) B(L(iso(w, yv, 0), iso(w, yv, ht)));
    const sun = 'M60,250 C140,40 460,40 540,250';
    B(sun);
    F(sun, 8, 1);
    T(sun, true);
    dots += '<circle cx="388" cy="92" r="9" fill="none" style="stroke:var(--g2)" stroke-width="1.6"/>';
    F(L(iso(0, 0, ht), iso(w, 0, ht)) + L(iso(w, 0, ht), iso(w, dpt, ht)), 6, 2);
  }

  if (key === 'boat') {
    for (let i = 0; i < 7; i++) {
      let d = '';
      for (let x = 0; x <= W; x += 6) {
        const yw = 380 + i * 30 + Math.sin(x * 0.03 + i) * (6 + i * 1.5);
        d += (x === 0 ? 'M' : 'L') + x + ',' + yw.toFixed(1) + ' ';
      }
      B(d);
      if (i === 2) F(d, 7, 1, true);
    }
    B('M120,372 L270,372 L250,404 L140,404 Z M170,372 L176,340 L222,340 L226,372');
    const cam: Point = [224, 352], fr = L(cam, [520, 250]) + L(cam, [540, 380]);
    B(fr);
    F(fr, 5, 0);
    T('M520,250 Q560,315 540,380');
    B(circ(470, 300, 14) + 'M462,288 L470,262 L478,288 ' + circ(520, 330, 11) + 'M514,321 L520,300 L526,321');
    B('M440,268 L500,268 L500,330 L440,330 Z');
    dots += '<circle cx="470" cy="300" r="3" style="fill:var(--g1)"/>';
    viewBox = '0 210 600 380';
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true" focusable="false" data-art="${key}">` +
    '<defs>' + grad(id, false) + grad(idr, true) + '</defs>' + base + dots + flow + '</svg>'
  );
}
