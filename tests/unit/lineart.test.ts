import { describe, expect, test } from 'bun:test';
import { thinPath, thinSvg } from '../../src/lib/art/thin';
import { lineArt } from '../../src/lib/lineart';
import { LINE_ART_KEYS } from '../../src/lib/lineart-keys';

// Three decimals: the 3D drawings print raw doubles whose last bits differ between platforms' math libraries.
const stable = (s: string) => s.replace(/(\.\d{3})\d+/g, '$1');

test.each([...LINE_ART_KEYS])('%s matches its snapshot', (k) => {
  expect(stable(lineArt(k, 'x'))).toMatchSnapshot();
});

test('every drawing has a flow stroke', () => {
  for (const k of LINE_ART_KEYS) expect(lineArt(k, 'x')).toContain('class="la-flow"');
});

test('gradients are user-space and namespaced', () => {
  const s = lineArt('hud', 'u1');
  expect(s).toContain('gradientUnits="userSpaceOnUse"');
  expect(s).toContain('id="u1-g"');
  expect(s).toContain('id="u1-gr"');
});

test('every gradient reference resolves inside its own drawing', () => {
  for (const k of LINE_ART_KEYS) {
    const s = lineArt(k, `p-${k}`);
    const ids = new Set([...s.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    const refs = [...s.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ids.has(ref)).toBe(true);
      expect(ref.startsWith(`p-${k}-`)).toBe(true);
    }
  }
});

test('the six keys', () => expect([...LINE_ART_KEYS]).toEqual(['voice', 'hud', 'pour', 'vla', 'rooftops', 'boat']));

test('drawings are decorative, labeled by key and square', () => {
  for (const k of LINE_ART_KEYS) {
    const s = lineArt(k, 'a');
    expect(s).toStartWith('<svg ');
    expect(s).toContain('aria-hidden="true"');
    expect(s).toContain(`data-art="${k}"`);
    expect(s).toContain('viewBox="0 0 600 600"');
  }
});

test('the boat has one flow stroke, its path', () => {
  expect(lineArt('boat', 'x').match(/class="la-flow"/g)).toHaveLength(1);
});

test('filled paths paint the line-art background', () => {
  for (const k of LINE_ART_KEYS) {
    const fills = [...lineArt(k, 'x').matchAll(/<path [^>]*style="fill:([^;"]*)/g)].map((m) => m[1]);
    for (const fill of fills) expect(fill).toBe('var(--la-bg)');
  }
  for (const k of ['pour', 'vla', 'boat'] as const) expect(lineArt(k, 'x')).toContain('fill:var(--la-bg)');
});

test('drawings stay within the size budget', () => {
  let total = 0;
  for (const k of LINE_ART_KEYS) {
    const n = lineArt(k, 'ex-0').length;
    expect(n).toBeLessThanOrEqual(24 * 1024);
    total += n;
  }
  expect(total).toBeLessThanOrEqual(100 * 1024);
});

describe('thinning', () => {
  test('collinear points collapse', () => expect(thinPath('M0,0 L1,0 L2,0')).toBe('M0,0 L2,0'));
  test('a point 0.3 off the line stays, one 0.2 off goes', () => {
    expect(thinPath('M0,0 L5,0.3 L10,0')).toBe('M0,0 L5,0.3 L10,0');
    expect(thinPath('M0,0 L5,0.2 L10,0')).toBe('M0,0 L10,0');
  });
  test('a closed subpath keeps its Z', () => expect(thinPath('M0,0 L1,0 L2,0 L2,2 Z')).toBe('M0,0 L2,0 L2,2 Z'));
  test('subpaths thin separately', () => expect(thinPath('M0,0 L1,0 L2,0 M5,5 L6,5 L7,5')).toBe('M0,0 L2,0 M5,5 L7,5'));
  test('thinPath leaves anything but plain polylines alone', () => {
    for (const d of ['M0,0 C1,1 2,1 3,0', 'M0,0 a5,5 0 1,0 10,0', 'M0,0 l1,0 l1,0', 'M10,10 H20 V20', 'M0 0 L1 0 L2 0', 'M1e-7,0 L1,0 L2,0'])
      expect(thinPath(d)).toBe(d);
  });
  test('numbers lose a trailing .0', () => expect(thinPath('M12.0,3.5 L20.0,3.5')).toBe('M12,3.5 L20,3.5'));
  test('thinSvg rewrites every d attribute', () =>
    expect(thinSvg('<path class="la-base" d="M0,0 L1,0 L2,0"/><path d="M0,0 C1,1 2,1 3,0"/>')).toBe(
      '<path class="la-base" d="M0,0 L2,0"/><path d="M0,0 C1,1 2,1 3,0"/>',
    ));
  test('lineArt thins its polylines', () => {
    for (const k of LINE_ART_KEYS)
      for (const [, d] of lineArt(k, 'x').matchAll(/ d="([^"]*)"/g))
        if (!/[^MLZ0-9.,\s-]/.test(d!)) expect(d).not.toMatch(/\d\.0(?!\d)/);
  });
  test('thinning computes distances without Math.hypot', () => {
    // Math.hypot's last bit differs between JavaScriptCore (Bun writes the snapshots) and V8 (Node builds the site).
    const hypot = Math.hypot;
    Math.hypot = () => {
      throw new Error('thinning called Math.hypot');
    };
    try {
      expect(thinPath('M0,0 L5,0.3 L10,0')).toBe('M0,0 L5,0.3 L10,0');
      // A closed subpath simplifies as a loop whose two ends coincide: distance() to a zero-length segment.
      expect(thinPath('M0,0 L1,0 L2,0 L2,2 Z')).toBe('M0,0 L2,0 L2,2 Z');
    } finally {
      Math.hypot = hypot;
    }
  });
});
