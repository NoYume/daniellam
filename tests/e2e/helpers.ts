import type { Page } from '@playwright/test';

/** Collects console errors and uncaught page errors for the life of the page. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Pins Math.random to 0, so the hero picks the first photo of each set (see fixtures.ts). */
export async function pinRandom(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
}

/** The vertical offset of an element's computed transform, in px. */
export async function translateY(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((el) => {
    const t = getComputedStyle(el).transform;
    return t === 'none' ? 0 : new DOMMatrixReadOnly(t).m42;
  });
}
