import { expect, test } from 'bun:test';
import { lineArt } from '../../src/lib/lineart';
import { LINE_ART_KEYS } from '../../src/lib/lineart-keys';

test.each([...LINE_ART_KEYS])('%s matches its snapshot', (k) => {
  expect(lineArt(k, 'x')).toMatchSnapshot();
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

test('drawings are decorative and labeled by kind', () => {
  const s = lineArt('arm', 'a');
  expect(s).toStartWith('<svg ');
  expect(s).toContain('aria-hidden="true"');
  expect(s).toContain('data-art="arm"');
  expect(s).toContain('viewBox="0 0 600 600"');
});

test('boat uses its cropped viewBox', () => {
  expect(lineArt('boat', 'b')).toContain('viewBox="0 210 600 380"');
});
