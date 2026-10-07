import { expect, test } from '@playwright/test';

test.describe('phones', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'phone layout (below 900px)');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`in ${scheme} mode`, () => {
      test.use({ colorScheme: scheme });

      test('no horizontal scroll at phone width', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => document.fonts.ready);
        const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        expect(widths.scroll).toBeLessThanOrEqual(widths.client);
        expect(widths.client).toBeLessThanOrEqual(390);
      });

      test('the shots page has no horizontal scroll', async ({ page }) => {
        await page.goto('/shots/');
        await page.evaluate(() => document.fonts.ready);
        const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        expect(widths.scroll).toBeLessThanOrEqual(widths.client);
        expect(widths.client).toBeLessThanOrEqual(390);
      });
    });
  }

  test('each research and experience entry shows its own media', async ({ page }) => {
    await page.goto('/');
    const research = page.locator('.rs-entry .entry-media');
    const experience = page.locator('.ex-entry .entry-media');
    await expect(research).toHaveCount(3);
    await expect(experience).toHaveCount(6);
    for (const media of [...(await research.all()), ...(await experience.all())]) await expect(media).toBeVisible();
    // The media sits above the entry's text.
    const first = page.locator('.ex-entry').first();
    const art = await first.locator('.entry-media').boundingBox();
    const name = await first.locator('.ex-co').boundingBox();
    expect(art!.y + art!.height).toBeLessThanOrEqual(name!.y);
    await expect(page.locator('.rs-entry').nth(1).locator('.entry-media video')).toHaveCount(1);
    await expect(page.locator('.rs-entry').nth(1).locator('.entry-cap')).toHaveText('Damage-aware data collection. Video: RobIn Lab');
  });

  test('pinned panels are hidden', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.rs-sticky')).toBeHidden();
    await expect(page.locator('#exArt')).toBeHidden();
  });

  test('nav keeps the theme button visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.theme-btn')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.bar-name')).toBeHidden();
    const links = await page.locator('.bar-links').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    const allVisible = await page.locator('.bar-links a').evaluateAll((as) => as.every((a) => a.getBoundingClientRect().right <= innerWidth));
    expect(links.scroll > links.client || allVisible).toBe(true);
    await page.locator('.bar-links a[href$="#contact"]').scrollIntoViewIfNeeded();
    await expect(page.locator('.bar-links a[href$="#contact"]')).toBeInViewport();
  });

  test('shots row has two columns', async ({ page }) => {
    await page.goto('/');
    const boxes = await page.locator('#shots .shot').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
    expect(boxes).toHaveLength(4);
    expect(Math.abs(boxes[0] - boxes[1])).toBeLessThan(1);
    expect(boxes[2]).toBeGreaterThan(boxes[0] + 100);
  });
});

test('desktop keeps the pinned panels, without inline copies', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout');
  await page.goto('/');
  await expect(page.locator('.rs-sticky')).toBeVisible();
  await expect(page.locator('.entry-media')).toHaveCount(9);
  for (const media of await page.locator('.entry-media').all()) await expect(media).toBeHidden();
});
