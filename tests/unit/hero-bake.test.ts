import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { bakeAll, bakePhoto, readHeroEntries, type HeroEntry } from '../../scripts/hero-bake';
import { mulberry32 } from '../../scripts/lib/random';
import { fogTile, grainTile } from '../../scripts/lib/tiles';
import type { HazeName } from '../../src/lib/haze';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hero-bake-test-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const HAZES = ['ice', 'denim', 'navy', 'silver', 'dusk'];

/** A real entry from src/content/hero.yaml. */
async function entry(id: string): Promise<HeroEntry> {
  const found = (await readHeroEntries()).find((e) => e.id === id);
  if (!found) throw new Error(`no hero entry ${id}`);
  return found;
}

/** Writes a synthetic JPEG with a gradient, so the glow and haze have something to read. */
async function synthetic(path: string, width: number, height: number, exif = false): Promise<void> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#1b2433"/><stop offset="1" stop-color="#e8d2a8"/></linearGradient>
    <rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  const image = sharp(Buffer.from(svg));
  await (exif ? image.withExif({ IFD0: { Copyright: 'test' } }) : image).jpeg().toFile(path);
}

// Reference values from the prototype's own mulberry (v6 line 552).
test('mulberry32 matches the prototype', () => {
  const r = mulberry32(19);
  expect(r()).toBeCloseTo(0.05854421923868358, 12);
  expect(r()).toBeCloseTo(0.32688822830095887, 12);
  expect(r()).toBeCloseTo(0.4525164095684886, 12);
  expect(mulberry32(7)()).toBeCloseTo(0.011704753153026104, 12);
});

test('fog tile is the 400×225 drawing at half size', async () => {
  const meta = await sharp(await fogTile()).metadata();
  expect([meta.width, meta.height, meta.hasAlpha]).toEqual([200, 113, true]);
});

test('fog sits in the middle band, clear at the top', async () => {
  const { data } = await sharp(await fogTile()).extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const rowMean = (y: number) => data.subarray(y * 200, (y + 1) * 200).reduce((s, v) => s + v, 0) / 200;
  expect(rowMean(0)).toBeLessThan(2);
  expect(rowMean(62)).toBeGreaterThan(10);
});

// The haze slides the fog sideways, so every place the tile repeats crosses the
// hero. v6's canvas fog stays as strong at its edges as inside them.
test('fog repeats without a seam: as strong at its edges as just inside them', async () => {
  const { data, info } = await sharp(await fogTile()).extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const colMean = (x: number) => {
    let sum = 0;
    for (let y = 0; y < h; y++) sum += data[y * w + x]!;
    return sum / h;
  };
  const inset = Math.round(w * 0.08);
  expect(colMean(0)).toBeGreaterThan(0.8 * colMean(inset));
  expect(colMean(w - 1)).toBeGreaterThan(0.8 * colMean(w - 1 - inset));
});

// Stretched 8× across the hero, a coarse alpha shows as contour bands. v6's fog has 159 levels.
test('fog keeps a smooth alpha, without bands', async () => {
  const { data } = await sharp(await fogTile()).extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  expect(new Set(data).size).toBeGreaterThan(100);
});

test('the tiles stay small, since they load before the first paint', async () => {
  expect((await grainTile()).length).toBeLessThan(25_000);
  expect((await fogTile()).length).toBeLessThan(6_000);
});

test('grain tile is 256×256 noise around mid-gray', async () => {
  const buf = await grainTile();
  const meta = await sharp(buf).metadata();
  expect([meta.width, meta.height]).toEqual([256, 256]);
  const [gray] = (await sharp(buf).stats()).channels;
  expect(gray.mean).toBeGreaterThan(118);
  expect(gray.mean).toBeLessThan(138);
  // Uniform noise over 128 ± 32 has a standard deviation of 64 / √12 ≈ 18.5.
  expect(gray.stdev).toBeGreaterThan(15);
  expect(gray.stdev).toBeLessThan(22);
});

test('bakes a photo at its own width, without metadata', async () => {
  // 2000px wide, like the stand-ins: the bake never enlarges, and drops the EXIF.
  const file = join(dir, 'exif.jpg');
  await synthetic(file, 2000, 1333, true);
  expect((await sharp(file).metadata()).exif).toBeDefined();
  const { png, baked } = await bakePhoto({ id: 'exif', file, set: 'night', photographer: 't', alt: 't' });
  const meta = await sharp(png).metadata();
  expect([meta.format, meta.width, meta.height]).toEqual(['png', 2000, 1333]);
  expect(meta.exif).toBeUndefined();
  expect([baked.width, baked.height, baked.png]).toEqual([2000, 1333, 'src/generated/hero/hero-exif.png']);
  expect(baked.average.every((c) => c >= 0 && c <= 255)).toBe(true);
}, 60_000);

test('bakes a larger photo down to 2560px wide', async () => {
  await synthetic(join(dir, 'wide.jpg'), 3200, 1800);
  const { png } = await bakePhoto({ id: 'wide', file: join(dir, 'wide.jpg'), set: 'day', photographer: 't', alt: 't' });
  const meta = await sharp(png).metadata();
  expect([meta.width, meta.height]).toEqual([2560, 1440]);
}, 60_000);

test('bakes a portrait photo without enlarging it', async () => {
  await synthetic(join(dir, 'portrait.jpg'), 1000, 1600);
  const { png, baked } = await bakePhoto({ id: 'portrait', file: join(dir, 'portrait.jpg'), set: 'night', photographer: 't', alt: 't' });
  const meta = await sharp(png).metadata();
  expect([meta.width, meta.height]).toEqual([1000, 1600]);
  expect(HAZES).toContain(baked.haze);
}, 60_000);

// The picks Daniel saw on screen in the prototype (spec 7.2). They check the
// stand-ins, so each case skips once its photo leaves hero.yaml.
const listed = new Set((await readHeroEntries()).map((e) => e.id));
const PARITY: [string, HazeName][] = [
  ['n1', 'denim'], ['n10', 'denim'], ['n8', 'denim'], ['n12', 'navy'], ['n5', 'dusk'],
  ['u7', 'silver'], ['p1076', 'silver'], ['u6', 'silver'], ['p1067', 'dusk'], ['p1047', 'dusk'],
];
for (const [id, haze] of PARITY) {
  test.skipIf(!listed.has(id))(`${id} gets ${haze} haze`, async () => {
    const { baked } = await bakePhoto(await entry(id));
    expect(baked.haze, `cool ${baked.cool.toFixed(3)}, mean ${baked.mean.toFixed(3)}`).toBe(haze);
  }, 60_000);
}

test('a photo that cannot be read stops the bake, naming it', async () => {
  const root = join(dir, 'broken-root');
  await mkdir(join(root, 'src/content'), { recursive: true });
  await writeFile(join(root, 'broken.jpg'), 'not a jpeg');
  await writeFile(join(root, 'src/content/hero.yaml'), '- { id: broken, file: broken.jpg, set: day, photographer: t, alt: t }\n');
  await expect(bakeAll({ root })).rejects.toThrow(/broken/);
});

test('a second bakeAll skips unchanged photos and re-bakes changed ones', async () => {
  const root = join(dir, 'cache-root');
  await mkdir(join(root, 'src/content'), { recursive: true });
  await synthetic(join(root, 'a.jpg'), 320, 180);
  await synthetic(join(root, 'b.jpg'), 320, 180);
  const yaml = (setB: string) =>
    `- { id: a, file: a.jpg, set: night, photographer: t, alt: t }\n- { id: b, file: b.jpg, set: ${setB}, photographer: t, alt: t }\n`;
  await writeFile(join(root, 'src/content/hero.yaml'), yaml('day'));

  const first = await bakeAll({ root });
  expect([first.baked.length, first.skipped]).toEqual([2, 0]);
  const json = await Bun.file(join(root, 'src/generated/hero.json')).json();
  expect(json.photos.map((p: { id: string }) => p.id)).toEqual(['a', 'b']);
  for (const f of ['hero/hero-a.png', 'hero/hero-b.png', 'fog.webp', 'grain.webp']) {
    expect(await Bun.file(join(root, 'src/generated', f)).exists()).toBe(true);
  }

  const second = await bakeAll({ root });
  expect([second.baked.length, second.skipped]).toEqual([0, 2]);

  // A replaced photo (new mtime) and a photo moved to the other set both bake again.
  await utimes(join(root, 'a.jpg'), new Date(), new Date(Date.now() + 5000));
  await writeFile(join(root, 'src/content/hero.yaml'), yaml('night'));
  const third = await bakeAll({ root });
  expect(third.baked.map((b) => b.id).sort()).toEqual(['a', 'b']);

  const forced = await bakeAll({ root, force: true });
  expect([forced.baked.length, forced.skipped]).toEqual([2, 0]);
}, 60_000);
