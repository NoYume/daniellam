import { afterAll, beforeAll, expect, test } from 'bun:test';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { checkContent, findDashes, type Problem } from '../../scripts/check-content';

const fixtures = resolve(import.meta.dir, '../fixtures');
let tmp: string, good: string, bad: string;

async function photo(path: string, withExif: boolean) {
  await mkdir(join(path, '..'), { recursive: true });
  const s = sharp({ create: { width: 8, height: 8, channels: 3, background: '#808080' } });
  await (withExif ? s.withExif({ IFD0: { Artist: 'test' } }) : s).jpeg().toFile(path);
}

// The trees are copied so the generated photos never land in the fixtures.
beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'check-content-'));
  good = join(tmp, 'good');
  bad = join(tmp, 'bad');
  await cp(join(fixtures, 'content-good'), good, { recursive: true });
  await cp(join(fixtures, 'content-bad'), bad, { recursive: true });
  await photo(join(good, 'src/assets/shots/clean.jpg'), false);
  await photo(join(bad, 'src/assets/shots/gps.jpg'), true);
});
afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

test('finds en and em dashes, not hyphens', () => {
  expect(findDashes('a–b—c-d')).toEqual([1, 3]);
  expect(findDashes('2025-2026')).toEqual([]);
});

test('good tree has no problems', async () => {
  expect(await checkContent(good)).toEqual([]);
});

test('bad tree reports each problem', async () => {
  const problems = await checkContent(bad);
  const has = (file: string, text: string) =>
    expect(
      problems.some((p: Problem) => p.file === file && p.message.includes(text)),
      `expected "${file}: ...${text}..." in\n${problems.map((p) => `${p.file}: ${p.message}`).join('\n')}`,
    ).toBe(true);
  has('src/content/research/bad.md', 'en or em dash');
  has('src/content/research/bad.md', "unknown line-art key 'spaceship'");
  has('src/content/experience/broken.md', 'frontmatter does not parse');
  has('src/content/hero.yaml', 'missing alt text');
  has('src/content/shots.yaml', 'missing credit');
  has('src/assets/shots/gps.jpg', 'contains metadata');
  has('src/components/Bad.astro', 'en or em dash');
  has('src/pages/entity.astro', 'en or em dash');
  has('src/content/recent.yaml', 'does not parse');
  // Only the entry without alt text is reported, not the fine one beside it.
  expect(problems.filter((p) => p.file === 'src/content/hero.yaml')).toHaveLength(1);
});

const script = resolve(import.meta.dir, '../../scripts/check-content.ts');

test('cli exits 1 and lists problems as file: message', () => {
  const run = Bun.spawnSync(['bun', script], { cwd: bad });
  expect(run.exitCode).toBe(1);
  expect(run.stderr.toString()).toContain('src/content/hero.yaml: missing alt text');
});

test('cli prints content ok for a clean tree', () => {
  const run = Bun.spawnSync(['bun', script], { cwd: good });
  expect(run.exitCode).toBe(0);
  expect(run.stdout.toString().trim()).toBe('content ok');
});
