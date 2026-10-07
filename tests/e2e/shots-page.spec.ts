import { expect, test } from '@playwright/test';
import { captionText, formatMonth, photoCount } from '../../src/lib/shots';
import { collectErrors } from './helpers';
import { PHOTO_COUNT, TRIPS } from './shots-data';

/** A trip's article. An attribute selector, since an id may start with a digit, and `#2025-x` isn't valid CSS. */
const tripArticle = (id: string) => `article[id="${id}"]`;

test('lists every trip, newest first, each linking to its trip', async ({ page, isMobile }) => {
  await page.goto('/shots/');
  await expect(page.getByRole('heading', { level: 1, name: 'Shots' })).toBeVisible();
  await expect(page.locator('main .sec-sub')).toHaveText('Travel and everyday photos, by trip.');
  const rows = page.locator('nav[aria-label="Trips"] li a');
  await expect(rows).toHaveCount(TRIPS.length);
  for (const [i, trip] of TRIPS.entries()) {
    const row = rows.nth(i);
    await expect(row).toHaveAttribute('href', `#${trip.id}`);
    await expect(row.locator('.tix-name')).toHaveText(trip.name);
    await expect(row.locator('.tix-when')).toHaveText(formatMonth(trip.month));
    if (isMobile) await expect(row.locator('.tix-n')).toBeHidden();
    else await expect(row.locator('.tix-n')).toHaveText(photoCount(trip.photos.length));
  }
  expect(await page.locator('article.trip').evaluateAll((articles) => articles.map((a) => a.id))).toEqual(TRIPS.map((t) => t.id));
});

test('each trip shows its cover, heading, note, grid and captions', async ({ page }) => {
  await page.goto('/shots/');
  for (const trip of TRIPS) {
    const article = page.locator(tripArticle(trip.id));
    const n = trip.photos.length;
    await expect(article.locator('h2.trip-name')).toHaveText(trip.name);
    await expect(article.locator('.trip-meta')).toHaveText(`${formatMonth(trip.month)} · ${photoCount(n)}`);
    if (trip.note) await expect(article.locator('.trip-note')).toHaveText(trip.note);
    else await expect(article.locator('.trip-note')).toHaveCount(0);
    await expect(article.locator('figure.cover img')).toHaveAttribute('alt', trip.photos[0]!.alt);
    await expect(article.locator('.grid figure.card')).toHaveCount(n - 1);
    const figures = article.locator('figure.photo');
    await expect(figures).toHaveCount(n);
    for (const [k, photo] of trip.photos.entries()) {
      const text = captionText(photo);
      const caption = figures.nth(k).locator('figcaption');
      if (text) await expect(caption, `${trip.id}, photo ${k + 1}`).toHaveText(text);
      else await expect(caption, `${trip.id}, photo ${k + 1}`).toHaveCount(0);
    }
  }
});

test('photos keep their space, and only the first cover loads eagerly', async ({ page }) => {
  await page.goto('/shots/');
  const images = page.locator('main img');
  await expect(images).toHaveCount(PHOTO_COUNT);
  const attributes = await images.evaluateAll((imgs) =>
    imgs.map((img) => ({ width: Number(img.getAttribute('width')), height: Number(img.getAttribute('height')), loading: img.getAttribute('loading') })),
  );
  for (const [i, a] of attributes.entries()) {
    expect(a.width, `image ${i + 1}: width`).toBeGreaterThan(0);
    expect(a.height, `image ${i + 1}: height`).toBeGreaterThan(0);
    expect(a.loading, `image ${i + 1}: loading`).toBe(i === 0 ? 'eager' : 'lazy');
  }
});

test('each photo links to its largest WebP', async ({ page, request }) => {
  await page.goto('/shots/');
  const links = page.locator('main a.ph-link');
  await expect(links).toHaveCount(PHOTO_COUNT);
  const photos = await links.evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href') ?? '', src: a.querySelector('img')?.getAttribute('src') })));
  for (const [i, { href, src }] of photos.entries()) {
    expect(href).toMatch(/^\/_astro\/.+\.webp$/);
    // The img's own src is the same file, so a photo wider than 2400px brings no full-size extra.
    expect(src, `photo ${i + 1}: img src`).toBe(href);
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
    expect(response.headers()['content-type'], href).toBe('image/webp');
  }
  // The srcset lists its widths smallest first.
  const srcset = (await links.first().locator('img').getAttribute('srcset')) ?? '';
  const largest = srcset.split(',').at(-1)!.trim().split(/\s+/)[0];
  expect(photos[0]!.href).toBe(largest);
});

test.describe(() => {
  test.use({ javaScriptEnabled: false });

  test('without JavaScript, every photo shows and a click opens its image', async ({ page }) => {
    await page.goto('/shots/');
    await expect(page.locator('main img')).toHaveCount(PHOTO_COUNT);
    await page.locator('a.ph-link').nth(1).click();
    await expect(page).toHaveURL(/\/_astro\/.+\.webp$/);
  });
});

test('three columns on laptops, two on phones', async ({ page, isMobile }) => {
  const most = TRIPS.reduce((a, b) => (b.photos.length > a.photos.length ? b : a));
  test.skip(most.photos.length < 4, 'needs a trip of 4 or more photos');
  await page.goto('/shots/');
  const grid = page.locator(`${tripArticle(most.id)} .grid`);
  const [columns, gap] = isMobile ? ['2', '10px'] : ['3', '14px'];
  await expect(grid).toHaveCSS('column-count', columns);
  await expect(grid).toHaveCSS('column-gap', gap);
  // Balanced columns can leave the last one empty for a few cards with a portrait among them.
  const lefts = await grid.locator('figure').evaluateAll((figures) => new Set(figures.map((f) => Math.round(f.getBoundingClientRect().left))).size);
  expect(lefts).toBeGreaterThanOrEqual(2);
  expect(lefts).toBeLessThanOrEqual(Number(columns));
});

test.describe('with reduced motion', () => {
  // Jumps are instant under reduced motion, and land where a smooth one would.
  test.use({ reducedMotion: 'reduce' });

  const SIZES = [[375, 629], [393, 659], [412, 839], [810, 1080], [1366, 657], [1512, 849], [1920, 947]] as const;

  test('a jump from the list shows the cover and the whole heading', async ({ page, isMobile }) => {
    test.skip(isMobile, 'resizes a desktop window instead');
    for (const [width, height] of SIZES) {
      await page.setViewportSize({ width, height });
      await page.goto('/shots/');
      for (const trip of TRIPS) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.locator(`.tix a[href="#${trip.id}"]`).click();
        await expect(page.locator('.bar')).toHaveClass(/\bsolid\b/);
        await expect.poll(() => page.locator('.bar').evaluate((b) => Math.round(b.getBoundingClientRect().bottom))).toBe(63);
        const m = await page.locator(tripArticle(trip.id)).evaluate((a) => {
          const box = (sel: string) => a.querySelector(sel)?.getBoundingClientRect();
          const phone = innerWidth <= 640;
          return {
            coverTop: box('figure.cover img')!.top,
            coverHeight: box('figure.cover img')!.height,
            expectedCover: Math.max(phone ? 170 : 220, Math.min(innerHeight - 79 - (phone ? 300 : 276), (phone ? 0.8 : 0.62) * innerWidth)),
            headingBottom: (box('.trip-note') ?? box('.trip-meta'))!.bottom,
            atEnd: Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 1,
            innerHeight,
          };
        });
        const at = `${trip.id} at ${width} x ${height}`;
        expect(Math.abs(m.coverHeight - m.expectedCover), `${at}: cover height`).toBeLessThanOrEqual(1);
        if (!m.atEnd) expect(Math.abs(m.coverTop - 79), `${at}: 16px under the bar`).toBeLessThanOrEqual(2);
        expect(m.headingBottom, `${at}: heading on screen`).toBeLessThanOrEqual(m.innerHeight);
      }
    }
  });

  test('a link straight to a trip lands like a jump', async ({ page, isMobile }) => {
    test.skip(isMobile, 'resizes a desktop window instead');
    test.skip(TRIPS.length < 2, 'needs a second trip');
    const trip = TRIPS[1]!;
    await page.setViewportSize({ width: 1512, height: 849 });
    await page.goto(`/shots/#${trip.id}`);
    await page.evaluate(() => document.fonts.ready);
    const article = page.locator(tripArticle(trip.id));
    // How far the cover's top is from 79px. The second trip can be the last one, which can't
    // scroll up to the bar where the page ends (spec 5.3), so there it counts as landed.
    await expect
      .poll(() =>
        article.evaluate((a) => {
          const atEnd = Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 1;
          return atEnd ? 0 : Math.abs(a.querySelector('figure.cover img')!.getBoundingClientRect().top - 79);
        }),
      )
      .toBeLessThanOrEqual(2);
    const headingBottom = await article.evaluate((a) => (a.querySelector('.trip-note') ?? a.querySelector('.trip-meta'))!.getBoundingClientRect().bottom);
    expect(headingBottom, 'heading on screen').toBeLessThanOrEqual(849);
  });
});

test('keyboard focus on a cover stays on screen', async ({ page, browserName }) => {
  await page.goto('/shots/');
  await page.locator('.tix a').last().focus();
  // Safari's Tab skips links unless a setting is on; Option-Tab reaches them.
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  const link = page.locator('figure.cover a.ph-link').first();
  await expect(link).toBeFocused();
  // Drawn inside the photo: outside, it would fall off the screen's edges.
  await expect(link).toHaveCSS('outline-style', 'solid');
  await expect(link).toHaveCSS('outline-offset', '-3px');
});

test('the page follows the saved mode, and the theme button switches it', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mode', 'light'));
  await page.goto('/shots/');
  // The Shots page itself: the 404 page has the same head script and bar.
  await expect(page.getByRole('heading', { level: 1, name: 'Shots' })).toBeVisible();
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-mode', 'light');
  await page.locator('.theme-btn').click();
  await expect(html).toHaveAttribute('data-mode', 'dark');
});

test('no console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/shots/');
  await page.locator('article.trip').last().scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});
