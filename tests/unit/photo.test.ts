import { afterAll, beforeAll, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, parse, resolve } from 'node:path';
import sharp, { type Sharp } from 'sharp';
import { hasMetadata } from '../../scripts/lib/exif';
import { photosStub, prepareFolder, preparePhoto } from '../../scripts/photo';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'photo-test-'));
  // trip/ holds two photos (a JPEG with EXIF and a PNG), a text file and a subfolder with another photo.
  await mkdir(join(dir, 'trip/sub'), { recursive: true });
  await image('trip/b.png', 400, 300);
  await image('trip/a.JPG', 400, 300, (s) => s.withExif({ IFD0: { Artist: 'test' } }));
  await writeFile(join(dir, 'trip/notes.txt'), 'not a photo');
  await image('trip/sub/c.jpg', 400, 300);
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Writes a test image; the extension picks PNG or JPEG. */
async function image(name: string, width: number, height: number, edit = (s: Sharp) => s): Promise<string> {
  const path = join(dir, name);
  const s = edit(sharp({ create: { width, height, channels: 3, background: { r: 90, g: 120, b: 160 } } }));
  await (name.endsWith('.png') ? s.png() : s.jpeg()).toFile(path);
  return path;
}

test('removes EXIF', async () => {
  const input = await image('exif.jpg', 4000, 3000, (s) => s.withExif({ IFD0: { Artist: 'test' } }));
  expect(await hasMetadata(input)).toBe(true);
  const output = await preparePhoto(input, join(dir, 'out'));
  expect(output).toBe(join(dir, 'out', 'exif.jpg'));
  expect(await hasMetadata(output)).toBe(false);
});

test('caps the long edge at 3000px', async () => {
  const input = await image('big.png', 4000, 3000);
  const output = await preparePhoto(input, join(dir, 'out'));
  expect(output).toBe(join(dir, 'out', 'big.jpg'));
  const meta = await sharp(output).metadata();
  expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 3000, 2250]);
});

test('applies EXIF orientation', async () => {
  const input = await image('rotated.jpg', 400, 200, (s) => s.withMetadata({ orientation: 6 }));
  const output = await preparePhoto(input, join(dir, 'out'), 'rotated-out');
  const meta = await sharp(output).metadata();
  expect([meta.width, meta.height]).toEqual([200, 400]);
});

const script = resolve(import.meta.dir, '../../scripts/photo.ts');

test('cli writes into src/assets/<folder> and prints the path', async () => {
  const input = await image('cli.jpg', 300, 200);
  const run = Bun.spawnSync(['bun', script, input, 'shots', 'street'], { cwd: dir });
  expect(run.exitCode).toBe(0);
  expect(run.stdout.toString().trim()).toBe(join('src/assets/shots', 'street.jpg'));
  expect(existsSync(join(dir, 'src/assets/shots/street.jpg'))).toBe(true);
});

test('cli rejects an unknown folder', async () => {
  const input = await image('cli-bad.jpg', 300, 200);
  const run = Bun.spawnSync(['bun', script, input, 'public'], { cwd: dir });
  expect(run.exitCode).not.toBe(0);
  expect(existsSync(join(dir, 'src/assets/public'))).toBe(false);
});

test('prepares every JPEG and PNG in a folder, in name order', async () => {
  const outputs = await prepareFolder(join(dir, 'trip'), join(dir, 'trip-out'));
  expect(outputs).toEqual([join(dir, 'trip-out', 'a.jpg'), join(dir, 'trip-out', 'b.jpg')]);
  for (const output of outputs) expect(await hasMetadata(output)).toBe(false);
  expect(existsSync(join(dir, 'trip-out', 'c.jpg'))).toBe(false);
});

test('puts numbered names in the order a file manager shows them', async () => {
  await mkdir(join(dir, 'numbered'));
  for (const name of ['p10.jpg', 'p2.jpg', 'p1.jpg']) await image(`numbered/${name}`, 40, 30);
  const outputs = await prepareFolder(join(dir, 'numbered'), join(dir, 'numbered-out'));
  expect(outputs.map((output) => parse(output).name)).toEqual(['p1', 'p2', 'p10']);
});

test('photosStub lists each photo with an empty alt, ready for shots.yaml', () => {
  expect(photosStub(['src/assets/shots/tokyo/a.jpg', 'src/assets/shots/tokyo/b.jpg'])).toBe(
    '  photos:\n    - file: ../assets/shots/tokyo/a.jpg\n      alt:\n    - file: ../assets/shots/tokyo/b.jpg\n      alt:\n',
  );
});

test('cli prepares a folder into a trip folder and prints the stub', async () => {
  const run = Bun.spawnSync(['bun', script, join(dir, 'trip'), 'shots/tokyo'], { cwd: dir });
  expect(run.exitCode).toBe(0);
  // Each output path, a blank line, then the stub.
  expect(run.stdout.toString()).toBe(
    'src/assets/shots/tokyo/a.jpg\nsrc/assets/shots/tokyo/b.jpg\n\n' +
      '  photos:\n    - file: ../assets/shots/tokyo/a.jpg\n      alt:\n    - file: ../assets/shots/tokyo/b.jpg\n      alt:\n',
  );
  expect(existsSync(join(dir, 'src/assets/shots/tokyo/b.jpg'))).toBe(true);
});

test("cli rejects a trip folder that isn't a slug", async () => {
  // A fresh working folder, so a leftover `tokyo` can't hide a folder made by mistake (macOS ignores case).
  const cwd = await mkdtemp(join(dir, 'reject-'));
  for (const bad of ['shots/Tokyo', 'shots/to_kyo', 'shots/-tokyo', 'shots/to--kyo', 'shots/tokyo/day-1', 'shots/']) {
    const run = Bun.spawnSync(['bun', script, join(dir, 'trip'), bad], { cwd });
    expect(run.exitCode, bad).not.toBe(0);
    expect(existsSync(join(cwd, 'src')), bad).toBe(false);
  }
});

test('cli takes no name for a folder', async () => {
  const cwd = await mkdtemp(join(dir, 'named-'));
  const run = Bun.spawnSync(['bun', script, join(dir, 'trip'), 'shots/tokyo', 'ferry'], { cwd });
  expect(run.exitCode).not.toBe(0);
  expect(existsSync(join(cwd, 'src'))).toBe(false);
});

// What macOS leaves beside a photo copied from some cards or unzipped: a hidden file named like the
// photo (`._IMG_0001.JPG`) that holds an AppleDouble header, not an image.
const appleDouble = Buffer.from([0x00, 0x05, 0x16, 0x07, 0x00, 0x02, 0x00, 0x00]);

test('skips hidden files, such as the ._ copies macOS makes beside photos', async () => {
  await mkdir(join(dir, 'hidden'));
  await image('hidden/b.jpg', 40, 30);
  await writeFile(join(dir, 'hidden/._a.JPG'), appleDouble); // sorts before the real photo
  await writeFile(join(dir, 'hidden/.DS_Store'), 'not a photo');
  const notes: string[] = [];
  const outputs = await prepareFolder(join(dir, 'hidden'), join(dir, 'hidden-out'), (note) => notes.push(note));
  expect(outputs).toEqual([join(dir, 'hidden-out', 'b.jpg')]);
  expect(existsSync(join(dir, 'hidden-out', '._a.jpg'))).toBe(false);
  // Not even a note: a hidden file is never a photo.
  expect(notes).toEqual([]);
});

/** A trip folder whose middle photo is not an image. Returns that file's path and the reason sharp gives for it. */
async function brokenTrip(name: string) {
  await mkdir(join(dir, name));
  await image(`${name}/a.jpg`, 40, 30);
  await writeFile(join(dir, name, 'b.jpg'), 'not an image');
  await image(`${name}/c.jpg`, 40, 30);
  const bad = join(dir, name, 'b.jpg');
  const reason = await sharp(bad).toBuffer().then(
    () => '',
    (error: Error) => error.message,
  );
  return { bad, reason };
}

test('a photo it cannot read stops the run with an error that names the file', async () => {
  const { bad, reason } = await brokenTrip('broken');
  expect(reason).not.toBe('');
  const error = await prepareFolder(join(dir, 'broken'), join(dir, 'broken-out')).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe(`${bad}: ${reason}`);
  // sharp's own error stays attached, for anything that wants its stack.
  expect((error as Error).cause).toBeInstanceOf(Error);
  // The photo before it stays written; the one after it is never reached.
  expect(existsSync(join(dir, 'broken-out', 'a.jpg'))).toBe(true);
  expect(existsSync(join(dir, 'broken-out', 'c.jpg'))).toBe(false);
});

test('cli exits 1 with one line naming the file and the reason, and no stack trace', async () => {
  const { bad, reason } = await brokenTrip('broken-cli');
  const cwd = await mkdtemp(join(dir, 'broken-run-'));
  const run = Bun.spawnSync(['bun', script, join(dir, 'broken-cli'), 'shots/tokyo'], { cwd });
  expect(run.exitCode).toBe(1);
  expect(run.stderr.toString()).toBe(`${bad}: ${reason}\n`);
  expect(run.stdout.toString()).toBe('');
  // Outputs written before the bad file stay (running again overwrites them).
  expect(existsSync(join(cwd, 'src/assets/shots/tokyo/a.jpg'))).toBe(true);
});

test('cli lists a skipped HEIC on stderr with the export hint, and still prepares the JPEG', async () => {
  await mkdir(join(dir, 'heic/iphone'), { recursive: true });
  await image('heic/iphone/IMG_0001.jpg', 40, 30);
  await writeFile(join(dir, 'heic/iphone/IMG_0002.HEIC'), 'not read');
  const run = Bun.spawnSync(['bun', script, 'iphone', 'shots/tokyo'], { cwd: join(dir, 'heic') });
  expect(run.exitCode).toBe(0);
  // stdout stays the outputs and the stub.
  expect(run.stdout.toString()).toBe(
    'src/assets/shots/tokyo/IMG_0001.jpg\n\n  photos:\n    - file: ../assets/shots/tokyo/IMG_0001.jpg\n      alt:\n',
  );
  expect(run.stderr.toString()).toBe('skipped iphone/IMG_0002.HEIC (export it as JPEG first)\n');
  expect(existsSync(join(dir, 'heic/src/assets/shots/tokyo/IMG_0001.jpg'))).toBe(true);
});

test('cli lists every other file it skips, in name order, but not hidden files or subfolders', async () => {
  await mkdir(join(dir, 'skips/iphone/edits'), { recursive: true });
  await image('skips/iphone/IMG_0001.jpg', 40, 30);
  await image('skips/iphone/edits/IMG_0001.jpg', 40, 30);
  await writeFile(join(dir, 'skips/iphone/notes.txt'), 'not a photo');
  await writeFile(join(dir, 'skips/iphone/img_0003.heif'), 'not read');
  await writeFile(join(dir, 'skips/iphone/._IMG_0001.jpg'), appleDouble);
  await writeFile(join(dir, 'skips/iphone/.DS_Store'), 'not a photo');
  const run = Bun.spawnSync(['bun', script, 'iphone', 'shots/tokyo'], { cwd: join(dir, 'skips') });
  expect(run.exitCode).toBe(0);
  expect(run.stderr.toString()).toBe('skipped iphone/img_0003.heif (export it as JPEG first)\nskipped iphone/notes.txt\n');
});

test('cli says so when a folder has no JPEG or PNG', async () => {
  const cwd = await mkdtemp(join(dir, 'empty-'));
  await mkdir(join(cwd, 'iphone'));
  await writeFile(join(cwd, 'iphone/IMG_1.HEIC'), 'not read');
  const run = Bun.spawnSync(['bun', script, 'iphone', 'shots/tokyo'], { cwd });
  expect(run.exitCode).not.toBe(0);
  expect(run.stderr.toString()).toContain('no .jpg, .jpeg or .png files in iphone');
  expect(existsSync(join(cwd, 'src'))).toBe(false);
});

test('originals dropped in photos/ are never committed', () => {
  // They still carry their metadata, GPS included; only `bun run photo` copies reach src/assets.
  for (const path of ['photos/hero/night/a.jpg', 'photos/hero/day/a.png', 'photos/shots/a.jpg', 'photos/README.md']) {
    expect(Bun.spawnSync(['git', 'check-ignore', '-q', path]).exitCode, `${path} is not ignored`).toBe(0);
  }
});
