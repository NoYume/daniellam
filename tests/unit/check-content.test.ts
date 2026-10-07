import { afterAll, beforeAll, expect, test } from 'bun:test';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { checkContent, findDashes, type Problem } from '../../scripts/check-content';

const fixtures = resolve(import.meta.dir, '../fixtures');
const SHOTS = 'src/content/shots.yaml';
let tmp: string, good: string, bad: string;

async function photo(path: string, withExif: boolean, width = 12, height = 8) {
  await mkdir(join(path, '..'), { recursive: true });
  const s = sharp({ create: { width, height, channels: 3, background: '#808080' } });
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
  await photo(join(bad, 'src/assets/shots/wide.jpg'), false);
  await photo(join(bad, 'src/assets/shots/tall.jpg'), false, 8, 12);
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
  has('src/content/projects.yaml', "'new' (2025-2026) is newer than 'old' (2024) above it");
  has('src/content/projects.yaml', "'ongoing' (2025-now) is newer than 'new' (2025-2026) above it");
  has(SHOTS, "'newer' (2025-06) is newer than 'older' (2024-01) above it; list the newest trip first");
  has(SHOTS, "trip id 'Bad_Id' must be lowercase letters and digits joined by single hyphens");
  has(SHOTS, "trip id 'older' is used more than once");
  has(SHOTS, "'Bad_Id' needs a month written YYYY-MM");
  has(SHOTS, "name of 'newer' is 31 characters; the limit is 24");
  has(SHOTS, "note of 'newer' is 76 characters; the limit is 70");
  has(SHOTS, "missing alt text for photo 1 of 'newer'");
  has(SHOTS, "missing credit for photo 2 of 'newer' (add credit, or mine: true)");
  has(SHOTS, "photo 3 of 'newer' says both mine: true and credit");
  has(SHOTS, "caption of photo 4 of 'newer' is 61 characters; the limit is 60");
  has(SHOTS, "'empty' has no photos");
  has(SHOTS, 'the homepage row needs exactly 4 teaser photos; shots.yaml marks 1');
  has(SHOTS, "the cover of 'Bad_Id' is 8 x 12; a cover must be landscape");
  // Only the entry without alt text is reported, not the fine one beside it.
  expect(problems.filter((p) => p.file === 'src/content/hero.yaml')).toHaveLength(1);
});

/** The shots.yaml problems for `yaml`, placed in a copy of the good tree. */
async function shotsProblems(name: string, yaml: string): Promise<string[]> {
  const dir = join(tmp, name);
  await cp(good, dir, { recursive: true });
  await Bun.write(join(dir, SHOTS), yaml);
  return (await checkContent(dir)).filter((p) => p.file === SHOTS).map((p) => p.message);
}

const trip = (id: string, month: string, file = 'clean.jpg') =>
  `- id: ${id}\n  name: ${id}\n  month: ${month}\n  mine: true\n  photos:\n    - file: ../assets/shots/${file}\n      alt: A street\n      teaser: true\n`;

test('a cover that cannot be read is reported', async () => {
  const messages = await shotsProblems('no-cover', trip('gone', '2025-06', 'missing.jpg'));
  expect(messages.some((m) => m.startsWith("the cover of 'gone' cannot be read: "))).toBe(true);
});

test('trip order skips a trip whose month is malformed', async () => {
  // As text, '2025-5' sorts after '2025-04', so comparing it would wrongly call it newer.
  const messages = await shotsProblems('order', trip('a', '2025-04') + trip('b', '2025-5') + trip('c', '2025-03'));
  expect(messages).toContain("'b' needs a month written YYYY-MM");
  expect(messages.filter((m) => m.includes('list the newest trip first'))).toEqual([]);
});

/** n teaser photos with alt text, for a trip that says `mine: true`. */
const streets = (n: number) => '    - file: ../assets/shots/clean.jpg\n      alt: A street\n      teaser: true\n'.repeat(n);

// Astro's file loader skips an entry with no id, so such a trip would quietly vanish from /shots/.
test('a trip with no id is reported by its position and name', async () => {
  const messages = await shotsProblems('no-id', `- name: Kyoto\n  month: 2025-06\n  mine: true\n  photos:\n${streets(4)}`);
  expect(messages).toEqual(["trip 1 ('Kyoto') has no id"]);
});

test('a null id and a missing name are reported by position alone', async () => {
  const messages = await shotsProblems('null-id', trip('a', '2025-07') + `- id:\n  month: 2025-06\n  mine: true\n  photos:\n${streets(3)}`);
  // The trip's three teasers still count toward the four, so there is nothing else to say.
  expect(messages).toEqual(['trip 2 has no id']);
});

test('trips with no id are not duplicates of each other', async () => {
  const noId = (name: string) => `- name: ${name}\n  month: 2025-06\n  mine: true\n  photos:\n${streets(2)}`;
  const messages = await shotsProblems('two-no-ids', noId('One') + noId('Two'));
  expect(messages).toEqual(["trip 1 ('One') has no id", "trip 2 ('Two') has no id"]);
});

test('a trip with no id still gets every other check, named by its position', async () => {
  const name = 'K'.repeat(25);
  const messages = await shotsProblems(
    'no-id-checks',
    `- name: ${name}\n  month: 2025-5\n  note: ${'n'.repeat(71)}\n  photos:\n    - file: ../assets/shots/missing.jpg\n` +
      '- name: Empty\n  month: 2025-01\n  photos: []\n',
  );
  expect(messages).toContain(`trip 1 ('${name}') has no id`);
  expect(messages).toContain("trip 2 ('Empty') has no id");
  expect(messages).toContain('trip 1 needs a month written YYYY-MM');
  expect(messages).toContain('name of trip 1 is 25 characters; the limit is 24');
  expect(messages).toContain('note of trip 1 is 71 characters; the limit is 70');
  expect(messages).toContain('missing alt text for photo 1 of trip 1');
  expect(messages).toContain('missing credit for photo 1 of trip 1 (add credit, or mine: true)');
  expect(messages.some((m) => m.startsWith('the cover of trip 1 cannot be read: '))).toBe(true);
  expect(messages).toContain('trip 2 has no photos');
  expect(messages.filter((m) => m.includes('undefined'))).toEqual([]);
});

test('trip order names a trip with no id by its position', async () => {
  const noId = (month: string) => `- name: Kyoto\n  month: ${month}\n  mine: true\n  photos:\n${streets(1)}`;
  const below = await shotsProblems('no-id-below', trip('a', '2025-01') + noId('2025-06'));
  expect(below).toContain("trip 2 (2025-06) is newer than 'a' (2025-01) above it; list the newest trip first");
  const above = await shotsProblems('no-id-above', noId('2025-01') + trip('b', '2025-06'));
  expect(above).toContain("'b' (2025-06) is newer than trip 1 (2025-01) above it; list the newest trip first");
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
