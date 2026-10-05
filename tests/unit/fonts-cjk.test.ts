import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchCjkSubset, parseWoff2Url } from '../../scripts/fonts-cjk';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fonts-cjk-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

test('parses the woff2 url from Google Fonts CSS', () => {
  expect(parseWoff2Url("src: url(https://fonts.gstatic.com/l/font?kit=abc) format('woff2');")).toBe(
    'https://fonts.gstatic.com/l/font?kit=abc',
  );
});

test('fails clearly when the CSS has no woff2 source', () => {
  expect(() => parseWoff2Url("src: url(https://example.com/a.ttf) format('truetype');")).toThrow(/woff2/);
});

test.skipIf(!!process.env.OFFLINE)('downloads a small woff2 subset once, then reuses it', async () => {
  const out = join(dir, 'labels.woff2');
  expect(await fetchCjkSubset(out)).toBe('fetched');
  const bytes = new Uint8Array(await Bun.file(out).arrayBuffer());
  expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('wOF2');
  // Ten characters, not the whole 7 MB family.
  expect(bytes.length).toBeLessThan(30_000);
  expect(await fetchCjkSubset(out)).toBe('cached');
}, 30_000);
