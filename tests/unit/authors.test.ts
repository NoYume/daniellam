import { expect, test } from 'bun:test';
import { shortName } from '../../src/lib/authors';

test('short names', () => {
  expect(shortName('Arnav Balaji')).toBe('A. Balaji');
  expect(shortName('Roberto Martín-Martín')).toBe('R. Martín-Martín');
});

test('every given name becomes an initial', () => {
  expect(shortName('Mary Jane Watson')).toBe('M. J. Watson');
  expect(shortName('  Junhong   Xu ')).toBe('J. Xu');
});

test('a single name stays whole', () => {
  expect(shortName('Plato')).toBe('Plato');
});
