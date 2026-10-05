import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { fetchZodiak, makeOgImage, makeTouchIcon, ogPhoto, parseTtfUrl } from '../../scripts/og';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'og-test-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

test('parses the truetype url', () => {
  expect(
    parseTtfUrl("url('//cdn.fontshare.com/wf/a.woff2') format('woff2'), url('//cdn.fontshare.com/wf/a.ttf') format('truetype')"),
  ).toBe('https://cdn.fontshare.com/wf/a.ttf');
});

test('fails clearly when the CSS has no truetype source', () => {
  expect(() => parseTtfUrl("url('//cdn.fontshare.com/wf/a.woff2') format('woff2')")).toThrow(/truetype/);
});

test('the link preview uses the first night photo, in hero.yaml order', () => {
  const photos = [
    { set: 'day', png: 'src/generated/hero/hero-d.png' },
    { set: 'night', png: 'src/generated/hero/hero-x.png' },
    { set: 'night', png: 'src/generated/hero/hero-y.png' },
  ] as const;
  expect(ogPhoto([...photos])).toBe('src/generated/hero/hero-x.png');
});

test('with no night photo the build stops, saying why', () => {
  expect(() => ogPhoto([{ set: 'day', png: 'src/generated/hero/hero-d.png' }])).toThrow(/night photo/);
});

test('touch icon is a 180×180 PNG on the dark page color', async () => {
  const png = await makeTouchIcon('public/favicon.svg');
  const meta = await sharp(png).metadata();
  expect([meta.format, meta.width, meta.height]).toEqual(['png', 180, 180]);
  const { data } = await sharp(png).extract({ left: 2, top: 2, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  expect([...data.subarray(0, 3)]).toEqual([0x0e, 0x0f, 0x11]);
});

test.skipIf(!!process.env.OFFLINE)('og image is 1200×630, with the name over a darkened left side', async () => {
  const photo = join(dir, 'photo.png');
  await sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: 120, g: 140, b: 170 } } }).png().toFile(photo);
  const png = await makeOgImage({ photo, name: 'Daniel Lam', line: 'Computer Science, The University of Texas at Austin.', zodiak: await fetchZodiak(join(dir, 'zodiak.ttf')) });
  const meta = await sharp(png).metadata();
  expect([meta.format, meta.width, meta.height]).toEqual(['png', 1200, 630]);
  // The scrim darkens the left edge; the right edge keeps the photo's color.
  const px = async (left: number, top: number) =>
    [...(await sharp(png).extract({ left, top, width: 1, height: 1 }).raw().toBuffer())].slice(0, 3);
  const [lr] = await px(4, 620);
  const [rr] = await px(1195, 620);
  expect(lr).toBeLessThan(40);
  expect(rr).toBeGreaterThan(100);
  // Light text pixels exist where the name is drawn.
  const { data, info } = await sharp(png).extract({ left: 60, top: 180, width: 560, height: 160 }).raw().toBuffer({ resolveWithObject: true });
  let bright = 0;
  for (let i = 0; i < data.length; i += info.channels) if (data[i] > 200 && data[i + 1] > 200) bright++;
  expect(bright).toBeGreaterThan(500);
}, 30_000);
