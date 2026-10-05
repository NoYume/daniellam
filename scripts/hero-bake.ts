// Bakes each hero photo once (spec 7.1): the film grade for its set, the glow
// on its brightest lights, and the haze color that matches it. Grain and edge
// shading stay in the browser. Run: bun run bake [--force]
import { existsSync } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { HazeName } from '../src/lib/haze';
import { blueHourWash, glowMask, grade, matchHaze, screen, type Raw } from './lib/film';
import { fogTile, grainTile } from './lib/tiles';

export interface HeroEntry {
  id: string;
  file: string;
  set: 'day' | 'night';
  place?: string;
  photographer: string;
  alt: string;
}

export interface BakedHero {
  id: string;
  set: 'day' | 'night';
  haze: HazeName;
  /** The haze match's inputs, kept for checking a pick. */
  cool: number;
  mean: number;
  average: [number, number, number];
  width: number;
  height: number;
  png: string;
}

const LONG_EDGE = 2560;

export async function readHeroEntries(root = process.cwd()): Promise<HeroEntry[]> {
  return Bun.YAML.parse(await Bun.file(join(root, 'src/content/hero.yaml')).text()) as HeroEntry[];
}

function raw(data: Buffer, width: number, height: number): Raw {
  return { data: new Uint8Array(data.buffer, data.byteOffset, data.length), width, height, channels: 3 };
}

/** Blurs an image at a Gaussian sigma and scales it by an opacity. */
async function blurred(img: Raw, sigma: number, opacity: number): Promise<Raw> {
  const data = await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 3 } })
    .blur(sigma)
    .linear(opacity, 0)
    .raw()
    .toBuffer();
  return raw(data, img.width, img.height);
}

export async function bakePhoto(entry: HeroEntry, root = process.cwd()): Promise<{ png: Buffer; baked: BakedHero }> {
  const { data, info } = await sharp(resolve(root, entry.file))
    .rotate()
    .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const night = entry.set === 'night';

  const graded = grade(raw(data, width, height), night ? 'bluehour' : 'casual');
  const { haze, cool, mean } = matchHaze(graded);

  // The glow: two blurs of the bright-pixel mask, sized for a 1440px-wide image.
  const { mask } = glowMask(graded);
  const scale = width / 1440;
  let glow = screen(await blurred(mask, 7 * scale, 0.6), await blurred(mask, 28 * scale, 0.55));
  let photo = graded;
  if (night) {
    photo = blueHourWash(photo);
    glow = blueHourWash(glow);
  }
  const out = screen(photo, glow);

  const png = await sharp(out.data, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const means = (await sharp(png).stats()).channels.map((c) => Math.round(c.mean));
  return {
    png,
    baked: {
      id: entry.id,
      set: entry.set,
      haze,
      cool,
      mean,
      average: [means[0], means[1], means[2]],
      width,
      height,
      png: `src/generated/hero/hero-${entry.id}.png`,
    },
  };
}

interface HeroJson {
  photos: BakedHero[];
  sources: Record<string, number>;
}

/** Bakes every photo in hero.yaml, skipping ones whose source and set are unchanged since the last bake. */
export async function bakeAll({ root = process.cwd(), force = false }: { root?: string; force?: boolean } = {}): Promise<{
  baked: BakedHero[];
  skipped: number;
}> {
  const entries = await readHeroEntries(root);
  const generated = join(root, 'src/generated');
  await mkdir(join(generated, 'hero'), { recursive: true });
  const jsonPath = join(generated, 'hero.json');
  const previous: HeroJson = existsSync(jsonPath) ? await Bun.file(jsonPath).json() : { photos: [], sources: {} };

  const photos: BakedHero[] = [];
  const sources: Record<string, number> = {};
  const baked: BakedHero[] = [];
  let skipped = 0;
  for (const entry of entries) {
    try {
      const mtime = (await stat(resolve(root, entry.file))).mtimeMs;
      const pngPath = join(root, `src/generated/hero/hero-${entry.id}.png`);
      const old = previous.photos.find((p) => p.id === entry.id);
      sources[entry.id] = mtime;
      if (!force && old && old.set === entry.set && previous.sources[entry.id] === mtime && existsSync(pngPath)) {
        photos.push(old);
        skipped++;
        continue;
      }
      const result = await bakePhoto(entry, root);
      await writeFile(pngPath, result.png);
      photos.push(result.baked);
      baked.push(result.baked);
    } catch (error) {
      throw new Error(`hero-bake: cannot bake '${entry.id}' (${entry.file}): ${(error as Error).message}`);
    }
  }

  await writeFile(join(generated, 'fog.webp'), await fogTile());
  await writeFile(join(generated, 'grain.webp'), await grainTile());
  await writeFile(jsonPath, JSON.stringify({ photos, sources } satisfies HeroJson, null, 2) + '\n');
  return { baked, skipped };
}

if (import.meta.main) {
  const { baked, skipped } = await bakeAll({ force: process.argv.includes('--force') });
  console.log(`baked ${baked.length}, skipped ${skipped}`);
}
