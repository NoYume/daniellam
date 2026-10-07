import { expect, test } from 'bun:test';
import { captionText, formatMonth, photoCount } from '../../src/lib/shots';

test('formatMonth writes the month out', () => {
  expect(formatMonth('2026-03')).toBe('March 2026');
  expect(formatMonth('2025-12')).toBe('December 2025');
  expect(formatMonth('2024-01')).toBe('January 2024');
});

test('photoCount says photo or photos', () => {
  expect(photoCount(1)).toBe('1 photo');
  expect(photoCount(6)).toBe('6 photos');
});

test('captionText joins the caption and the credit', () => {
  expect(captionText({ caption: 'Shinjuku on a rainy night', credit: 'Pema G. Lama' })).toBe('Shinjuku on a rainy night. Photo: Pema G. Lama');
  expect(captionText({ caption: 'Shinjuku on a rainy night' })).toBe('Shinjuku on a rainy night');
  expect(captionText({ credit: 'Pema G. Lama' })).toBe('Photo: Pema G. Lama');
  expect(captionText({})).toBeUndefined();
});
