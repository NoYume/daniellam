// Prepares photos before they enter the public repo: turns each upright, caps
// the long edge at 3000px and saves a JPEG with all metadata (EXIF, GPS,
// XMP, IPTC) removed.
// Usage: bun run photo <file> <dest> [name]
//        bun run photo <folder> <dest>
// <dest> is hero, shots, people or research, and may add one lowercase folder
// (shots/tokyo). A folder takes every JPEG and PNG in it, in name order, and
// prints the `photos:` stub to paste under a trip in src/content/shots.yaml.
// Hidden files and subfolders are ignored, and other files (HEIC photos, say) are
// listed as skipped on stderr. A photo that can't be read stops the run and names
// the file; the photos before it stay written.
import { statSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { join, parse, relative } from 'node:path';
import sharp from 'sharp';

const FOLDERS = ['hero', 'shots', 'people', 'research'];
const DEST = new RegExp(`^(${FOLDERS.join('|')})(/[a-z0-9]+(-[a-z0-9]+)*)?$`);

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

const PHOTO = /\.(jpe?g|png)$/i;
const HEIF = /\.hei[cf]$/i;

/**
 * Prepares every JPEG and PNG directly in inputDir, in name order. Subfolders and hidden files
 * (macOS makes a `._IMG_0001.JPG` beside each photo it copies from some cards) are skipped without
 * a word; onSkip gets a note for every other file passed over. A photo sharp can't read stops the
 * run with an error that names the file, and the outputs written before it stay.
 */
export async function prepareFolder(inputDir: string, outDir: string, onSkip: (note: string) => void = () => {}): Promise<string[]> {
  const files = (await readdir(inputDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    // Numbers count as numbers (p2 before p10), the way a file manager orders them.
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  for (const name of files.filter((name) => !PHOTO.test(name))) {
    onSkip(`skipped ${join(inputDir, name)}${HEIF.test(name) ? ' (export it as JPEG first)' : ''}`);
  }
  const outputs: string[] = [];
  // One at a time: decoding a full-size camera original takes a lot of memory.
  for (const name of files.filter((name) => PHOTO.test(name))) {
    const input = join(inputDir, name);
    try {
      outputs.push(await preparePhoto(input, outDir));
    } catch (error) {
      throw new Error(`${input}: ${(error as Error).message}`, { cause: error });
    }
  }
  return outputs;
}

/** A `photos:` block to paste under a trip in shots.yaml, each file relative to src/content and each alt left empty. */
export function photosStub(outputs: string[]): string {
  const photos = outputs.map((output) => `    - file: ${relative('src/content', output)}\n      alt:\n`);
  return `  photos:\n${photos.join('')}`;
}

if (import.meta.main) {
  const [input, dest, name] = process.argv.slice(2);
  const isFolder = Boolean(input && statSync(input, { throwIfNoEntry: false })?.isDirectory());
  if (!input || !dest || !DEST.test(dest) || (isFolder && name)) {
    const to = `<${FOLDERS.join('|')}>[/<trip>]`;
    console.error(`usage: bun run photo <file> ${to} [name]\n       bun run photo <folder> ${to}`);
    process.exit(1);
  }
  const outDir = join('src/assets', dest);
  if (!isFolder) {
    console.log(await preparePhoto(input, outDir, name));
  } else {
    // stderr gets the skipped files and any error, so stdout stays the outputs and the stub.
    const outputs = await prepareFolder(input, outDir, (note) => console.error(note)).catch((error: Error) => {
      console.error(error.message);
      process.exit(1);
    });
    if (outputs.length === 0) {
      console.error(`no .jpg, .jpeg or .png files in ${input} (export HEIC photos as JPEG first)`);
      process.exit(1);
    }
    // Each output path, a blank line, then the stub (which already ends in a newline).
    process.stdout.write(`${outputs.join('\n')}\n\n${photosStub(outputs)}`);
  }
}
