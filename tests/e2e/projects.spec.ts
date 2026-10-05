import { expect, test, type Page } from '@playwright/test';

const NAMES = ['LittleFilm', 'Music Playlist Explorer', 'SBI Portal', 'Choose Your Adventure', 'SBI Email Automation', 'SafeManiBench', 'Austin Sound Permits'];
const LIVE: Record<string, string> = {
  LittleFilm: 'https://project3-flixster.onrender.com/',
  'SBI Portal': 'https://utsbi.org',
  'Choose Your Adventure': 'https://choose-your-adventure-green.vercel.app/',
};
const CODE = [
  'https://github.com/NoYume/Project3-Flixster',
  'https://github.com/NoYume/Project2-Music-Playlist-Explorer',
  'https://github.com/utsbi/portal',
  'https://github.com/NoYume/Choose-Your-Adventure',
  'https://github.com/utsbi/automation-system',
  'https://github.com/NoYume/SafeManiBench-RoboSuite-Legacy',
  'https://github.com/dysonspheres/soundOrdinanceProject',
];

test('the seven projects, newest first', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#projects .pj-text')).toHaveText(NAMES);
  await expect(page.locator('#projects .pj-years')).toHaveText(['2026', '2026', '2025-2026', '2025', '2025', '2025', '2025']);
  await expect(page.locator('#projects .pj-tech').first()).toHaveText('JavaScript, HTML, CSS, TMDB API');
  await expect(page.locator('#projects .sec-sub')).toHaveText('Tools for student groups, class projects and research code, each linked to its live site or repo.');
});

test('projects link to their live sites and code', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('#projects .pj');
  for (let i = 0; i < NAMES.length; i++) {
    const row = rows.nth(i);
    const live = LIVE[NAMES[i]!];
    await expect(row.locator('.pj-link')).toHaveAttribute('href', live ?? CODE[i]!);
    await expect(row.locator('.pj-links a')).toHaveText(live ? ['Live ↗', 'Code ↗'] : ['Code ↗']);
    await expect(row.getByRole('link', { name: 'Code ↗' })).toHaveAttribute('href', CODE[i]!);
    if (live) await expect(row.getByRole('link', { name: 'Live ↗' })).toHaveAttribute('href', live);
  }
  // The arrow is decorative: each name link is read as the project's name.
  await expect(rows.first().locator('.pj-link')).toHaveAccessibleName('LittleFilm');
  await expect(page.locator('#projects a[target]')).toHaveCount(0);
});

const box = (page: Page, sel: string, i = 0) => page.locator(sel).nth(i).evaluate((el: Element) => el.getBoundingClientRect().toJSON());

test('an index on laptops, rows on phones', async ({ page, isMobile }) => {
  await page.goto('/');
  const name = await box(page, '#projects .pj-name');
  const years = await box(page, '#projects .pj-years');
  const sum = await box(page, '#projects .pj-sum');
  if (isMobile) {
    expect(years.bottom).toBeLessThanOrEqual(name.top + 1); // the years sit above the name
    expect(sum.top).toBeGreaterThanOrEqual(name.bottom - 1); // the summary below it
  } else {
    expect(Math.abs(years.top - name.top)).toBeLessThan(24); // one row: name, summary, years
    expect(sum.left).toBeGreaterThan(name.left + 200);
    expect(years.left).toBeGreaterThan(sum.right);
  }
});

test('hovering a name draws its underline under every line', async ({ page, isMobile }) => {
  test.skip(isMobile, 'touch screens have no hover');
  await page.goto('/');
  const text = page.locator('#projects .pj-text').nth(1);
  await expect(text).toHaveCSS('display', 'inline'); // an inline background follows each line of a wrap
  await expect(text).toHaveCSS('background-size', '0px 1px');
  await text.hover();
  await expect(text).toHaveCSS('background-size', '100% 1px');
});

test('keyboard focus on a name draws its underline', async ({ page, browserName }) => {
  await page.goto('/');
  const link = page.locator('#projects .pj-link').first();
  await page.locator('#projects .pj .lt').first().focus();
  // Back onto the name, by keyboard. Safari's Tab skips links; Option-Tab reaches them.
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab');
  await expect(link).toBeFocused();
  await expect(link.locator('.pj-text')).toHaveCSS('background-size', '100% 1px');
  await expect(link).toHaveCSS('outline-style', 'none');
});

async function arrows(page: Page) {
  return page.locator('#projects .pj-link').evaluateAll((links) =>
    links.map((a) => {
      const last = a.querySelector('.pj-last')!;
      const arrow = a.querySelector('.pj-arrow')!.getBoundingClientRect();
      const probe = document.createElement('span'); // a zero-size box on the baseline
      probe.style.cssText = 'display:inline-block;width:0;height:0';
      last.insertBefore(probe, last.lastChild);
      const baseline = probe.getBoundingClientRect().top;
      probe.remove();
      const cs = getComputedStyle(a);
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const capTop = baseline - ctx.measureText('E').actualBoundingBoxAscent;
      const word = last.firstChild!;
      const range = document.createRange();
      range.selectNodeContents(word);
      const line = [...range.getClientRects()].pop()!;
      return { name: a.textContent, offset: arrow.top - capTop, sameLine: arrow.top >= line.top && arrow.bottom <= line.bottom, after: arrow.left - line.right };
    }),
  );
}

test("the arrow sits on the cap line of the last word's line, wrapped or not", async ({ page }) => {
  await page.goto('/');
  const asLaidOut = await arrows(page);
  await page.addStyleTag({ content: '#projects .pj-name { width: 200px }' }); // every multi-word name wraps
  for (const r of [...asLaidOut, ...(await arrows(page))]) {
    expect(Math.abs(r.offset), `${r.name}: arrow top vs cap line`).toBeLessThanOrEqual(1);
    expect(r.sameLine, `${r.name}: arrow on the last word's line`).toBe(true);
    expect(r.after, `${r.name}: arrow right after the word`).toBeGreaterThan(0);
  }
});
