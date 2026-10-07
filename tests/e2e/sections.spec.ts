import { expect, test } from '@playwright/test';
import { FIRST_NIGHT } from './fixtures';
import { collectErrors, pinRandom } from './helpers';
import { TRIPS } from './shots-data';

test('shots are grayscale until hover', async ({ page, isMobile }) => {
  test.skip(isMobile, 'touch screens use the middle of the screen instead');
  await page.goto('/');
  const shot = page.locator('#shots .shot').first();
  await shot.scrollIntoViewIfNeeded();
  await expect(shot.locator('img')).toHaveCSS('filter', /grayscale\(1\)/);
  await shot.hover();
  await expect(shot.locator('img')).toHaveCSS('filter', 'none');
});

test('shots turn to color in the middle on touch', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'only touch screens without hover');
  await page.goto('/');
  const shot = page.locator('#shots .shot').first();
  await expect(shot.locator('img')).toHaveCSS('filter', /grayscale\(1\)/);
  await shot.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(shot).toHaveClass(/\bin-view\b/);
  await expect(shot.locator('img')).toHaveCSS('filter', 'none');
});

test('shots row: the four teasers, lazy and credited', async ({ page }) => {
  // The first photo marked as a teaser, in page order.
  const first = TRIPS.flatMap((trip) => trip.photos).find((photo) => photo.teaser)!;
  await page.goto('/');
  await expect(page.locator('#shots .shot img')).toHaveCount(4);
  await expect(page.locator('#shots .shot img').first()).toHaveAttribute('loading', 'lazy');
  await expect(page.locator('#shots .shot img').first()).toHaveAttribute('alt', first.alt);
  const caption = page.locator('#shots .shot').first().locator('figcaption');
  if (first.credit) await expect(caption).toHaveText(`Photo: ${first.credit}`);
  else await expect(caption).toHaveCount(0);
});

test('the shots row links to the shots page', async ({ page, isMobile }) => {
  await page.goto('/');
  const link = page.locator('#shots').getByRole('link', { name: 'See all shots' });
  await expect(link).toHaveAttribute('href', '/shots/');
  const box = (await link.boundingBox())!;
  const subtitle = (await page.locator('#shots .sec-sub').boundingBox())!;
  if (isMobile) {
    expect(box.y, 'below the subtitle').toBeGreaterThanOrEqual(subtitle.y + subtitle.height);
  } else {
    const middle = box.y + box.height / 2;
    expect(middle, 'on the subtitle line').toBeGreaterThanOrEqual(subtitle.y);
    expect(middle, 'on the subtitle line').toBeLessThanOrEqual(subtitle.y + subtitle.height);
  }
  await link.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Shots' })).toBeVisible();
});

test.describe('in dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('contact and footer', async ({ page }) => {
  await pinRandom(page);
  await page.goto('/');
  await expect(page.locator('#contact h2')).toHaveText(/Get in touch\./);
  await expect(page.locator('#contact a[href="mailto:daniel.wingchi.lam@gmail.com"]')).toHaveText('daniel.wingchi.lam@gmail.com');
  await expect(page.locator('#contact .contact-links a')).toHaveText(['GitHub ↗', 'LinkedIn ↗', 'Résumé ↓']);
  const footer = page.locator('footer');
  await expect(footer).toContainText(`Daniel Lam, ${new Date().getFullYear()}`);
  await expect(footer.locator('svg.pg')).toBeVisible();
  await expect(footer.locator('#footCredit')).toHaveText(FIRST_NIGHT.footCredit);
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`in ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test('404 page', async ({ page }) => {
      const errors = collectErrors(page);
      const response = await page.goto('/nope');
      expect(response?.status()).toBe(404);
      await expect(page.locator('h1')).toHaveText("This page doesn't exist.");
      await expect(page.locator('main a[href="/"]')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-mode', scheme);
      await expect(page.locator('.bar-name')).toHaveCSS('opacity', '1');
      await expect(page.locator('footer svg.pg')).toBeVisible();
      await expect(page.locator('.hero')).toHaveCount(0);
      expect(errors.filter((e) => !e.includes('404'))).toEqual([]);
    });
  });
}
