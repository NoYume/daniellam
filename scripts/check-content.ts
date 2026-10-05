// Content checks that run before every build (spec 5.2). Any problem stops
// the build, so the live site is never replaced by a broken one.
// Run: bun run check:content
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

  // 3. Alt text everywhere, and credits for photos by anyone else.
  const entries = (file: string): Data[] => {
    const value = data.get(file);
    return Array.isArray(value) ? (value as Data[]) : [];
  };
  for (const entry of entries('src/content/hero.yaml')) {
    if (!entry.alt) report('src/content/hero.yaml', `missing alt text for '${entry.id}'`);
    if (!entry.photographer) report('src/content/hero.yaml', `missing credit (photographer) for '${entry.id}'`);
  }
  for (const entry of entries('src/content/shots.yaml')) {
    if (!entry.alt) report('src/content/shots.yaml', `missing alt text for '${entry.id}'`);
    if (!entry.credit && entry.mine !== true) report('src/content/shots.yaml', `missing credit for '${entry.id}' (add credit, or mine: true)`);
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
