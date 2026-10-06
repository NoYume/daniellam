import { expect, test } from 'bun:test';
import { Pen } from '../../src/lib/art/pen';
import { fit, type V3 } from '../../src/lib/art/d3';
import { pose3 } from '../../src/lib/art/franka3';

test('the svg wrapper keeps the site markup', () => {
  const s = new Pen('u').svg('pour');
  expect(s).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" aria-hidden="true" focusable="false" data-art="pour"><defs><linearGradient id="u-g" gradientUnits="userSpaceOnUse"');
  expect(s).toContain('<linearGradient id="u-gr" ');
  expect(s).toEndWith('</svg>');
});

test('fills paint the line-art background', () => {
  const p = new Pen('u');
  p.Fill('M0,0 L1,0 L1,1 Z');
  p.Fill('M0,0 L2,0 L2,2 Z', 0.5);
  const s = p.svg('pour');
  expect(s).toContain('<path class="la-base" d="M0,0 L1,0 L1,1 Z" style="fill:var(--la-bg)"/>');
  expect(s).toContain('<path class="la-base" d="M0,0 L2,0 L2,2 Z" style="fill:var(--la-bg);stroke-opacity:calc(var(--base-op) * 0.5)"/>');
});

test('base strokes come first, then dots, then tint and flow', () => {
  const p = new Pen('u');
  p.F('M0,0 L1,1');
  p.dot([1, 1]);
  p.B('M0,0 L2,2');
  const s = p.svg('pour');
  expect(s.indexOf('la-base')).toBeLessThan(s.indexOf('la-dot'));
  expect(s.indexOf('la-dot')).toBeLessThan(s.indexOf('la-flow'));
});

test('fit puts every point inside its box and fills it one way', () => {
  const pts: V3[] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]];
  const q = pts.map(fit(-35, 26, pts, 30, 64, 570, 536).P);
  for (const [x, y] of q) {
    expect(x).toBeGreaterThanOrEqual(30 - 1e-9);
    expect(x).toBeLessThanOrEqual(570 + 1e-9);
    expect(y).toBeGreaterThanOrEqual(64 - 1e-9);
    expect(y).toBeLessThanOrEqual(536 + 1e-9);
  }
  const w = Math.max(...q.map((p) => p[0])) - Math.min(...q.map((p) => p[0]));
  const h = Math.max(...q.map((p) => p[1])) - Math.min(...q.map((p) => p[1]));
  expect(Math.max(w / 540, h / 472)).toBeCloseTo(1, 9);
});

test('the Franka puts its hand where it is posed', () => {
  const H: V3 = [0.09, -0.08, 0.055];
  const arm = pose3([0.46, 0.14, 0], H, 0);
  const w = arm.W(arm.k.H);
  expect(Math.hypot(w[0] - H[0], w[1] - H[1], w[2] - H[2])).toBeLessThan(1e-6);
});
