import { afterAll, beforeAll, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp, { type Sharp } from 'sharp';
import { hasMetadata } from '../../scripts/lib/exif';
import { preparePhoto } from '../../scripts/photo';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'photo-test-'));
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

test('originals dropped in photos/ are never committed', () => {
  // They still carry their metadata, GPS included; only `bun run photo` copies reach src/assets.
  for (const path of ['photos/hero/night/a.jpg', 'photos/hero/day/a.png', 'photos/shots/a.jpg', 'photos/README.md']) {
    expect(Bun.spawnSync(['git', 'check-ignore', '-q', path]).exitCode, `${path} is not ignored`).toBe(0);
  }
});
