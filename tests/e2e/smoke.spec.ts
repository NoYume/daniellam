import { test, expect } from '@playwright/test';

test('homepage shows the name', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Daniel Lam');
});

// No test browser lacks unprefixed backdrop-filter, so this reads the built
// CSS: Chrome needs the plain property, Safari before 18 the -webkit- one.
test('every backdrop blur ships with its -webkit- twin', async ({ page, request }) => {
  await page.goto('/');
  const hrefs = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => links.map((l) => (l as HTMLLinkElement).href));
  let css = (await page.locator('style').allTextContents()).join('');
  for (const href of hrefs) css += await (await request.get(href)).text();
  const plain = css.match(/(?<![-\w])backdrop-filter:/g) ?? [];
  const prefixed = css.match(/-webkit-backdrop-filter:/g) ?? [];
  expect(plain.length).toBeGreaterThan(0);
  expect(prefixed.length).toBe(plain.length);
});
