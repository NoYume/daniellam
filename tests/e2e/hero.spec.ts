import { expect, test } from '@playwright/test';
import { FIRST_DAY, FIRST_NIGHT } from './fixtures';
import { collectErrors, pinRandom, translateY } from './helpers';

const photo = '.hero-media .hero-photo img';

test.beforeEach(async ({ page }) => {
  await pinRandom(page);
});

test.describe('in dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('dark mode shows the first night photo with its credit and haze', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(photo)).toHaveAttribute('data-photo', FIRST_NIGHT.id);
    await expect(page.locator(photo)).toHaveAttribute('alt', FIRST_NIGHT.alt);
    await expect(page.locator('#credit')).toHaveText(FIRST_NIGHT.credit);
    await expect(page.locator('.hero')).toHaveAttribute('data-haze', FIRST_NIGHT.haze);
    await expect(page.locator(photo)).toHaveCSS('opacity', '1');
  });

  test('only one hero photo downloads, at one size', async ({ page }) => {
    const ids = new Set<string>();
    const files = new Set<string>();
    page.on('request', (request) => {
      const match = /\/_astro\/hero-([a-z0-9]+)\./.exec(request.url());
      if (!match) return;
      ids.add(match[1]);
      files.add(request.url());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect([...ids]).toEqual([FIRST_NIGHT.id]);
    // The preload must pick the same file as the picture, or phones download two sizes.
    expect([...files]).toHaveLength(1);
  });

  test('toggle crossfades to the other set', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(photo)).toHaveAttribute('data-set', 'night');
    await page.locator('.theme-btn').click();
    await expect(page.locator(`${photo}[data-set="day"]`)).toHaveCSS('opacity', '1', { timeout: 3000 });
    await expect(page.locator('#credit')).toHaveText(FIRST_DAY.credit);
    await expect(page.locator('.hero')).toHaveAttribute('data-haze', FIRST_DAY.haze);
    // The old photo is removed once the new one has faded in.
    await expect(page.locator(photo)).toHaveCount(1);
  });

  test("rapid toggles end on the final mode's photo", async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(photo)).toHaveAttribute('data-set', 'night');
    const button = page.locator('.theme-btn');
    await button.click();
    await button.click();
    await button.click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
    await expect(page.locator(photo)).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator(photo)).toHaveAttribute('data-set', 'day');
    await expect(page.locator('#credit')).toHaveText(FIRST_DAY.credit);
  });

  test('no console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page.locator(photo)).toHaveCSS('opacity', '1');
    await page.locator('.theme-btn').click();
    await expect(page.locator(`${photo}[data-set="day"]`)).toHaveCSS('opacity', '1', { timeout: 3000 });
    expect(errors).toEqual([]);
  });

  test('the title shows when the hero photo fails', async ({ page }) => {
    const errors = collectErrors(page);
    await page.route(/\/_astro\/hero-/, (route) => route.abort());
    await page.goto('/');
    // The photo was chosen and requested, and never arrived.
    await expect(page.locator(photo)).toHaveAttribute('data-photo', FIRST_NIGHT.id);
    await page.waitForLoadState('load');
    expect(await page.locator(photo).evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(0);
    await expect(page.locator('h1')).toHaveText('Daniel Lam');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.hero-edu')).toBeVisible();
    // The browser reports the blocked download itself; only page errors count.
    expect(errors.filter((e) => !e.startsWith('Failed to load resource'))).toEqual([]);
  });
});

test.describe('in light mode', () => {
  test.use({ colorScheme: 'light' });

  test('light mode shows the first day photo', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(photo)).toHaveAttribute('data-photo', FIRST_DAY.id);
    await expect(page.locator('#credit')).toHaveText(FIRST_DAY.credit);
    await expect(page.locator('.hero')).toHaveAttribute('data-haze', FIRST_DAY.haze);
  });
});

test('scroll parallax moves the layers', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect.poll(() => translateY(page, '.hero-media')).toBeCloseTo(165, 0);
  await expect.poll(() => translateY(page, '.haze')).toBeCloseTo(90, 0);
  await expect.poll(() => translateY(page, '.hero-content')).toBeCloseTo(54, 0);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('reduced motion keeps the layers still', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(300);
    await expect(page.locator('.hero-media')).toHaveCSS('transform', 'none');
    await expect(page.locator('.haze')).toHaveCSS('transform', 'none');
  });
});

test('restored scroll position is applied on load', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
  // WebKit records the position to restore a moment after scrolling stops,
  // as it would for a reader who scrolled and then reloaded.
  await page.waitForTimeout(1000);
  await page.reload();
  await page.waitForLoadState('load');
  await expect
    .poll(async () => {
      const { y, h } = await page.evaluate(() => ({ y: window.scrollY, h: document.querySelector<HTMLElement>('.hero')!.offsetHeight }));
      return Math.abs((await translateY(page, '.hero-media')) - 0.55 * Math.min(y, h)) < 2 && y > 0;
    })
    .toBe(true);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('without JavaScript a hero photo still shows', async ({ page }) => {
    await page.goto('/');
    const img = page.locator('.hero-photo.is-static img');
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
    await expect(img).toHaveCSS('opacity', '1');
  });
});
