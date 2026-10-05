import { expect, test } from 'bun:test';
import { siteUrl } from '../../scripts/lib/site-url';

// Cloudflare's Workers Builds sets WORKERS_CI=1 (and CI=true); GitHub Actions sets only CI.
test('a Cloudflare build without SITE_URL stops, naming the variable', () => {
  expect(() => siteUrl({ CI: 'true', WORKERS_CI: '1' })).toThrow(/SITE_URL/);
});

test('SITE_URL is the address wherever it is set', () => {
  const url = 'https://daniellam.example.workers.dev';
  expect(siteUrl({ CI: 'true', WORKERS_CI: '1', SITE_URL: url })).toBe(url);
  expect(siteUrl({ SITE_URL: url })).toBe(url);
});

test('local and GitHub Actions builds fall back to localhost', () => {
  expect(siteUrl({})).toBe('http://localhost:4321');
  expect(siteUrl({ CI: 'true' })).toBe('http://localhost:4321');
});
