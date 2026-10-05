// Prepares a photo before it enters the public repo: turns it upright, caps
// the long edge at 3000px and saves a JPEG with all metadata (EXIF, GPS,
// XMP, IPTC) removed. Usage: bun run photo <file> <folder> [name]
import { mkdir } from 'node:fs/promises';
import { join, parse } from 'node:path';
import sharp from 'sharp';

const FOLDERS = ['hero', 'shots', 'people', 'research'];

export async function preparePhoto(input: string, outDir: string, name?: string): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const output = join(outDir, `${name ?? parse(input).name}.jpg`);
  // sharp drops all metadata unless asked to keep it, so this never calls keepMetadata or withMetadata.
  await sharp(input)
    .rotate()
    .resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(output);
  return output;
}

if (import.meta.main) {
  const [file, folder, name] = process.argv.slice(2);
  if (!file || !folder || !FOLDERS.includes(folder)) {
    console.error(`usage: bun run photo <file> <${FOLDERS.join('|')}> [name]`);
    process.exit(1);
  }
  console.log(await preparePhoto(file, join('src/assets', folder), name));
}
