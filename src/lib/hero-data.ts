// Build time only: each hero photo's delivery sizes, credit and haze color,
// for the head script and the Hero component (spec 7.4).
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { getOrdered } from './content';
import type { HazeName } from './haze';

export interface HeroPhoto {
  id: string;
  set: 'day' | 'night';
  /** srcset attributes, 640-2560px wide (never wider than the photo). */
  avif: string;
  webp: string;
  /** The 1280px WebP, for the img fallback. */
  src: string;
  width: number;
  height: number;
  alt: string;
  credit: string;
  footCredit: string;
  haze: HazeName;
}

const WIDTHS = [640, 960, 1280, 1920, 2560];

// Globs rather than imports, so type checks pass before the first bake.
// Only image processing may read the PNGs: reading a property such as
// png.width makes Astro ship the 5 MB original next to the AVIF and WebP sizes.
const pngs = import.meta.glob<ImageMetadata>('/src/generated/hero/*.png', { eager: true, import: 'default' });
const bakes = import.meta.glob<{ photos: { id: string; haze: HazeName; width: number; height: number }[] }>('/src/generated/hero.json', {
  eager: true,
  import: 'default',
});

export async function getHeroPhotos(): Promise<HeroPhoto[]> {
  const baked = bakes['/src/generated/hero.json'];
  if (!baked) throw new Error('src/generated/hero.json is missing: run `bun run bake` (the build runs it first).');
  const photos: HeroPhoto[] = [];
  for (const { id, data } of await getOrdered('hero')) {
    const png = pngs[`/src/generated/hero/hero-${id}.png`];
    const bake = baked.photos.find((p) => p.id === id);
    if (!png || !bake) throw new Error(`hero photo '${id}' has not been baked: run \`bun run bake\`.`);
    const [avif, webp] = await Promise.all([
      getImage({ src: png, format: 'avif', width: 1280, widths: WIDTHS }),
      getImage({ src: png, format: 'webp', width: 1280, widths: WIDTHS }),
    ]);
    photos.push({
      id,
      set: data.set,
      avif: avif.srcSet.attribute,
      webp: webp.srcSet.attribute,
      src: webp.src,
      width: bake.width,
      height: bake.height,
      alt: data.alt,
      credit: `${data.place ? `${data.place}. ` : ''}Photo: ${data.photographer}`,
      footCredit: `Hero photo: ${data.photographer}`,
      haze: bake.haze,
    });
  }
  return photos;
}
