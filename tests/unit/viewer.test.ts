import { expect, test } from 'bun:test';
import { opensViewer, swipeStep, wrapIndex } from '../../src/scripts/viewer';

test('wrapIndex wraps at both ends', () => {
  expect(wrapIndex(-1, 6)).toBe(5);
  expect(wrapIndex(6, 6)).toBe(0);
  expect(wrapIndex(2, 6)).toBe(2);
  expect(wrapIndex(1, 1)).toBe(0);
});

test('swipeStep needs 40px, more sideways than down', () => {
  expect(swipeStep(-40, 0)).toBe(1);
  expect(swipeStep(60, -10)).toBe(-1);
  expect(swipeStep(-39, 0)).toBe(0);
  expect(swipeStep(-60, 70)).toBe(0);
});

test('opensViewer only for a plain primary click', () => {
  const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
  expect(opensViewer(plain)).toBe(true);
  for (const key of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const) expect(opensViewer({ ...plain, [key]: true })).toBe(false);
  expect(opensViewer({ ...plain, button: 1 })).toBe(false);
});
