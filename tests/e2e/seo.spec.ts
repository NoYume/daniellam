import { expect, test } from '@playwright/test';

test('head has link previews and JSON-LD', async ({ page }) => {
  await page.goto('/');
  const meta = (selector: string) => page.locator(`head ${selector}`).getAttribute('content');
  expect(await meta('meta[property="og:image"]')).toMatch(/^http.*\/og\.png$/);
  expect(await meta('meta[property="og:title"]')).toBe('Daniel Lam');
  expect(await meta('meta[property="og:type"]')).toBe('website');
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
  expect(await meta('meta[name="description"]')).toContain('UT Austin');
  expect(await page.locator('head link[rel="canonical"]').getAttribute('href')).toMatch(/^http.*\/$/);
  await expect(page.locator('head link[rel="icon"][href="/favicon.svg"]')).toHaveCount(1);
  await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveCount(1);
  const person = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(person['@type']).toBe('Person');
  expect(person.name).toBe('Daniel Lam');
  expect(person.affiliation.name).toBe('The University of Texas at Austin');
  expect(person.sameAs).toEqual(['https://github.com/NoYume', 'https://www.linkedin.com/in/danielwlam']);
});

test('robots, sitemap and images are served', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain('sitemap-index.xml');
  expect((await request.get('/sitemap-index.xml')).status()).toBe(200);
  const sitemap = await request.get('/sitemap-0.xml');
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).not.toContain('404');
  const og = await request.get('/og.png');
  expect(og.status()).toBe(200);
  expect(og.headers()['content-type']).toBe('image/png');
  expect((await request.get('/favicon.svg')).status()).toBe(200);
  expect((await request.get('/apple-touch-icon.png')).status()).toBe(200);
});

test('the 404 page asks not to be indexed', async ({ page }) => {
  await page.goto('/nope');
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});
