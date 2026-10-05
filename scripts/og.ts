// The link-preview image (1200×630: his name over a night photo) and the
// Apple touch icon, made at build time. Run: bun run og
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import type { BakedHero } from './hero-bake';

const W = 1200;
const H = 630;
const BG = '#0E0F11';
const INK = '#F0F1F2';

/** The https URL of the TrueType source in Fontshare's CSS (satori can't read woff2). */
export function parseTtfUrl(css: string): string {
  const match = /url\(['"]?((?:https:)?\/\/[^'")]+)['"]?\)\s*format\(['"]truetype['"]\)/.exec(css);
  if (!match) throw new Error('og: no truetype source in the Fontshare CSS');
  return match[1].startsWith('//') ? `https:${match[1]}` : match[1];
}

/** Zodiak 400 as TrueType, fetched once into a gitignored cache (the licence forbids committing it). */
export async function fetchZodiak(cacheFile = 'src/generated/fonts/zodiak-400.ttf'): Promise<ArrayBuffer> {
  if (existsSync(cacheFile)) return Bun.file(cacheFile).arrayBuffer();
  const css = await fetch('https://api.fontshare.com/v2/css?f[]=zodiak@400');
  if (!css.ok) throw new Error(`og: Fontshare CSS returned ${css.status}`);
  const font = await fetch(parseTtfUrl(await css.text()));
  if (!font.ok) throw new Error(`og: font download returned ${font.status}`);
  const data = await font.arrayBuffer();
  await mkdir(dirname(cacheFile), { recursive: true });
  await Bun.write(cacheFile, data);
  return data;
}

/** The baked photo behind the name: the first night photo, in hero.yaml's order. */
export function ogPhoto(photos: Pick<BakedHero, 'set' | 'png'>[]): string {
  const night = photos.find((p) => p.set === 'night');
  if (!night) throw new Error('og: hero.yaml has no night photo for the link preview; add one with set: night');
  return night.png;
}

export async function makeOgImage(opts: { photo: string; name: string; line: string; zodiak: ArrayBuffer }): Promise<Buffer> {
  const photo = await sharp(opts.photo).resize(W, H, { fit: 'cover' }).toBuffer();
  const scrim = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <linearGradient id="s" x2="1" y2="0"><stop offset="0" stop-color="${BG}" stop-opacity=".9"/><stop offset=".7" stop-color="${BG}" stop-opacity="0"/></linearGradient>
      <rect width="100%" height="100%" fill="url(#s)"/></svg>`,
  );
  const text = await satori(
    {
      type: 'div',
      props: {
        style: { width: W, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 72px', color: INK, fontFamily: 'Zodiak' },
        children: [
          { type: 'div', props: { style: { fontSize: 96, lineHeight: 1, letterSpacing: '-0.022em' }, children: opts.name } },
          { type: 'div', props: { style: { fontSize: 28, marginTop: 24, maxWidth: 760 }, children: opts.line } },
        ],
      },
    },
    { width: W, height: H, fonts: [{ name: 'Zodiak', data: opts.zodiak, weight: 400, style: 'normal' }] },
  );
  return sharp(photo)
    .composite([{ input: scrim }, { input: Buffer.from(text) }])
    .png()
    .toBuffer();
}

/** 180×180 PNG: the penguin centered on the dark page color. */
export async function makeTouchIcon(svgPath: string): Promise<Buffer> {
  const penguin = await sharp(svgPath, { density: 600 }).resize(132, 132, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: 180, height: 180, channels: 3, background: BG } })
    .composite([{ input: penguin, gravity: 'center' }])
    .png()
    .toBuffer();
}

if (import.meta.main) {
  const site = (Bun.YAML.parse(await Bun.file('src/content/site.yaml').text()) as { site: { name: string; educationLine: string } }).site;
  const { photos } = (await Bun.file('src/generated/hero.json').json()) as { photos: BakedHero[] };
  const og = await makeOgImage({
    photo: ogPhoto(photos),
    name: site.name,
    line: site.educationLine,
    zodiak: await fetchZodiak(),
  });
  await Bun.write('public/og.png', og);
  await Bun.write('public/apple-touch-icon.png', await makeTouchIcon('public/favicon.svg'));
  console.log('og: wrote public/og.png and public/apple-touch-icon.png');
}
