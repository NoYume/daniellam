// Fetches Noto Serif TC 500 subset to the ten characters of the section
// labels, so the page loads a few KB instead of the whole family. Noto is
// OFL-licensed, so subsetting it is fine (unlike Zodiak and Switzer).
// Run: bun run fonts [--force]
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export const CJK_LABELS = '研究經歷作品攝影聯絡';

const OUT = 'src/generated/fonts/noto-serif-tc-labels.woff2';
// Google Fonts sends woff2 only to browsers it knows support it.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

export function parseWoff2Url(css: string): string {
  const match = /url\((['"]?)(https:[^'")]+)\1\)\s*format\(['"]woff2['"]\)/.exec(css);
  if (!match) throw new Error('fonts-cjk: no woff2 source in the Google Fonts CSS');
  return match[2];
}

/** Downloads the subset unless the same labels were already fetched into outFile. */
export async function fetchCjkSubset(outFile = OUT, { force = false } = {}): Promise<'fetched' | 'cached'> {
  const stamp = `${outFile}.txt`;
  if (!force && existsSync(outFile) && existsSync(stamp) && (await Bun.file(stamp).text()) === CJK_LABELS) return 'cached';

  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@500&text=${encodeURIComponent(CJK_LABELS)}`;
  const css = await fetch(cssUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!css.ok) throw new Error(`fonts-cjk: Google Fonts CSS returned ${css.status}`);
  const font = await fetch(parseWoff2Url(await css.text()));
  if (!font.ok) throw new Error(`fonts-cjk: font download returned ${font.status}`);

  await mkdir(dirname(outFile), { recursive: true });
  await Bun.write(outFile, await font.arrayBuffer());
  await Bun.write(stamp, CJK_LABELS);
  return 'fetched';
}

if (import.meta.main) {
  console.log(`fonts: ${await fetchCjkSubset(OUT, { force: process.argv.includes('--force') })}`);
}
