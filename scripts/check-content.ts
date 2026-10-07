// Content checks that run before every build (spec 5.2). Any problem stops
// the build, so the live site is never replaced by a broken one.
// Run: bun run check:content
import { join } from 'node:path';
import sharp from 'sharp';
import { LINE_ART_KEYS } from '../src/lib/lineart-keys';
import { hasMetadata } from './lib/exif';

export interface Problem {
  file: string;
  message: string;
}

const DASH = /[–—]/g;
// HTML entities that render as the same dashes.
const DASH_ENTITY = /&(?:mdash|ndash);|&#(?:8211|8212);|&#x(?:2013|2014);/gi;

/** Indexes of en dashes (U+2013) and em dashes (U+2014). */
export function findDashes(text: string): number[] {
  return [...text.matchAll(DASH)].map((m) => m.index);
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

async function scan(root: string, pattern: string): Promise<string[]> {
  const files: string[] = [];
  for await (const file of new Bun.Glob(pattern).scan({ cwd: root, onlyFiles: true })) files.push(file);
  return files.sort();
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
// A trip's id (only Astro's file loader reads it, so the schema has no rule for it) and its month
// (the same pattern as the schema in src/content.config.ts).
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

type Data = Record<string, unknown>;

export async function checkContent(root: string): Promise<Problem[]> {
  const problems: Problem[] = [];
  const report = (file: string, message: string) => problems.push({ file, message });

  // 1. Hyphens only, in content and in component copy.
  const copyFiles = [
    ...(await scan(root, 'src/content/**/*.{md,yaml}')),
    ...(await scan(root, 'src/{components,pages,layouts}/**/*.astro')),
  ];
  const texts = new Map<string, string>();
  for (const file of copyFiles) {
    const text = await Bun.file(`${root}/${file}`).text();
    texts.set(file, text);
    const lines = new Set([...findDashes(text), ...[...text.matchAll(DASH_ENTITY)].map((m) => m.index)].map((i) => lineOf(text, i)));
    for (const line of [...lines].sort((a, b) => a - b)) report(file, `en or em dash on line ${line}; use a hyphen`);
  }

  // 2. Everything parses. Astro's loaders log these errors without failing the build.
  const data = new Map<string, unknown>();
  for (const [file, text] of texts) {
    if (file.endsWith('.yaml')) {
      try {
        data.set(file, Bun.YAML.parse(text));
      } catch (error) {
        report(file, `YAML does not parse: ${(error as Error).message}`);
      }
    } else if (file.endsWith('.md')) {
      const match = FRONTMATTER.exec(text);
      if (!match) continue;
      try {
        data.set(file, Bun.YAML.parse(match[1]) ?? {});
      } catch (error) {
        report(file, `frontmatter does not parse: ${(error as Error).message}`);
      }
    }
  }

  // 3. Alt text and a credit on every hero photo. (The Shots photos follow rule 7.)
  const entries = (file: string): Data[] => {
    const value = data.get(file);
    return Array.isArray(value) ? (value as Data[]) : [];
  };
  for (const entry of entries('src/content/hero.yaml')) {
    if (!entry.alt) report('src/content/hero.yaml', `missing alt text for '${entry.id}'`);
    if (!entry.photographer) report('src/content/hero.yaml', `missing credit (photographer) for '${entry.id}'`);
  }

  // 4. Every line-art key names a drawing that exists.
  const keys: readonly string[] = LINE_ART_KEYS;
  for (const [file, value] of data) {
    const fm = value as Data;
    let art: unknown;
    if (file.startsWith('src/content/research/')) art = (fm.media as Data | undefined)?.art;
    else if (file.startsWith('src/content/experience/')) art = fm.art;
    if (art !== undefined && !keys.includes(String(art))) report(file, `unknown line-art key '${art}'; use one of ${keys.join(', ')}`);
  }

  // 5. No photo metadata (EXIF can hold a location). `bun run photo` strips it.
  for (const file of await scan(root, 'src/assets/**/*.{jpg,jpeg,png,webp,avif,gif,tif,tiff}')) {
    try {
      if (await hasMetadata(`${root}/${file}`)) report(file, 'contains metadata; add it with `bun run photo`, which strips it');
    } catch (error) {
      report(file, `cannot be read: ${(error as Error).message}`);
    }
  }

  // 6. Projects are listed newest first, by each one's last year. `now` is the
  // newest of all, so ongoing projects lead.
  const lastYear = (years: unknown) => {
    const last = String(years).split('-').pop();
    return last === 'now' ? Infinity : Number(last);
  };
  const projects = entries('src/content/projects.yaml');
  projects.slice(1).forEach((entry, i) => {
    const above = projects[i]!;
    if (lastYear(entry.years) > lastYear(above.years)) {
      report('src/content/projects.yaml', `'${entry.id}' (${entry.years}) is newer than '${above.id}' (${above.years}) above it; list the newest project first`);
    }
  });

  // 7. Trips in shots.yaml (Shots page spec 3.1, 3.2): newest first, a slug id and a month each,
  // alt text and a credit on every photo that isn't his, the length limits (they keep a
  // jump's whole heading on screen), a landscape cover, and one photo per homepage slot.
  const SHOTS = 'src/content/shots.yaml';
  const TEASERS = 4;
  const size = (value: unknown) => [...String(value)].length;
  const limit = (what: string, owner: string, value: unknown, max: number) => {
    if (value != null && size(value) > max) report(SHOTS, `${what} of ${owner} is ${size(value)} characters; the limit is ${max}`);
  };
  const ids = new Set<string>();
  const repeated = new Set<string>();
  let above: { ref: string; month: string } | undefined; // the nearest trip above with a well-formed month
  let teasers = 0;
  const trips = entries(SHOTS);
  for (const [n, trip] of trips.entries()) {
    // Astro's file loader skips an entry with no id and only logs it, so the trip would vanish from
    // /shots/ and the homepage row while the build stays green. The checks below name such a trip by
    // its position in the file (`ref`), as they name the others by id.
    let ref = `trip ${n + 1}`;
    if (trip.id == null) {
      const name = String(trip.name ?? '');
      report(SHOTS, `${ref}${name ? ` ('${name}')` : ''} has no id`);
    } else {
      const id = String(trip.id);
      ref = `'${id}'`;
      if (!SLUG.test(id)) report(SHOTS, `trip id '${id}' must be lowercase letters and digits joined by single hyphens`);
      if (ids.has(id) && !repeated.has(id)) {
        report(SHOTS, `trip id '${id}' is used more than once`);
        repeated.add(id);
      }
      ids.add(id);
    }

    // Months compare as text, which is date order for YYYY-MM. A malformed one is skipped.
    const month = String(trip.month);
    if (!MONTH.test(month)) {
      report(SHOTS, `${ref} needs a month written YYYY-MM`);
    } else {
      if (above && month > above.month) report(SHOTS, `${ref} (${month}) is newer than ${above.ref} (${above.month}) above it; list the newest trip first`);
      above = { ref, month };
    }

    limit('name', ref, trip.name, 24);
    limit('note', ref, trip.note, 70);

    const photos = Array.isArray(trip.photos) ? (trip.photos as Data[]) : [];
    if (photos.length === 0) report(SHOTS, `${ref} has no photos`);
    photos.forEach((photo, i) => {
      const where = `photo ${i + 1} of ${ref}`;
      if (!photo.alt) report(SHOTS, `missing alt text for ${where}`);
      if (!photo.credit && photo.mine !== true && trip.mine !== true) report(SHOTS, `missing credit for ${where} (add credit, or mine: true)`);
      if (photo.mine === true && photo.credit) report(SHOTS, `${where} says both mine: true and credit`);
      limit('caption', where, photo.caption, 60);
      if (photo.teaser === true) teasers++;
    });

    // The cover is the first photo. A portrait one would show as a thin slice.
    const cover = photos[0];
    if (cover) {
      try {
        const { width = 0, height = 0 } = await sharp(join(root, 'src/content', String(cover.file))).metadata();
        if (width <= height) report(SHOTS, `the cover of ${ref} is ${width} x ${height}; a cover must be landscape`);
      } catch (error) {
        report(SHOTS, `the cover of ${ref} cannot be read: ${(error as Error).message}`);
      }
    }
  }
  // Not when the file didn't parse: rule 2 has said so, and "marks 0" would only add noise.
  if (data.has(SHOTS) && teasers !== TEASERS) report(SHOTS, `the homepage row needs exactly ${TEASERS} teaser photos; shots.yaml marks ${teasers}`);

  return problems;
}

if (import.meta.main) {
  const problems = await checkContent(process.cwd());
  if (problems.length > 0) {
    for (const p of problems) console.error(`${p.file}: ${p.message}`);
    process.exit(1);
  }
  console.log('content ok');
}
