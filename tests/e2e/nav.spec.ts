import { expect, test } from '@playwright/test';
import { collectErrors } from './helpers';

test('bar turns solid after the first scroll', async ({ page }) => {
  await page.goto('/');
  const bar = page.locator('.bar');
  await expect(bar).not.toHaveClass(/\bsolid\b/);
  await page.evaluate(() => window.scrollBy(0, 100));
  await expect(bar).toHaveClass(/\bsolid\b/);
});

test('the solid bar blurs what scrolls under it', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.scrollBy(0, 100));
  const bar = page.locator('.bar');
  await expect(bar).toHaveClass(/\bsolid\b/);
  await expect(bar).toHaveCSS('backdrop-filter', 'blur(14px) saturate(1.2)');
});

test('name docks into the bar after the hero', async ({ page }) => {
  await page.goto('/');
  const name = page.locator('.bar-name');
  await expect(name).toHaveCSS('opacity', '0');
  await page.locator('#about').scrollIntoViewIfNeeded();
  await expect(name).toHaveCSS('opacity', '1');
});

test('current section is underlined', async ({ page }) => {
  await page.goto('/');
  await page.locator('#research').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(page.locator('.bar-links a[href$="#research"]')).toHaveClass(/\bis-active\b/);
  await expect(page.locator('.bar-links a.is-active')).toHaveCount(1);
});

test.describe('with a dark system setting', () => {
  test.use({ colorScheme: 'dark' });

  test('theme button switches, labels and remembers', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const button = page.locator('.theme-btn');
    await expect(html).toHaveAttribute('data-mode', 'dark');
    await expect(button).toHaveAttribute('aria-label', 'Switch to light mode');
    await button.click();
    await expect(html).toHaveAttribute('data-mode', 'light');
    await expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
    await page.reload();
    await expect(html).toHaveAttribute('data-mode', 'light');
    await expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
  });

  test('toggle works when storage is blocked', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('Storage is blocked', 'SecurityError');
        },
      });
    });
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await page.locator('.theme-btn').click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
    expect(errors).toEqual([]);
  });
});

test('skip link reaches the content', async ({ page, browserName }) => {
  await page.goto('/');
  const skip = page.locator('.skip');
  await expect(skip).not.toBeInViewport();
  // Safari's Tab skips links unless a setting is on; Option-Tab reaches them.
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => !!document.getElementById('main')?.contains(document.activeElement))).toBe(true);
});

test('every tab stop through the bar can be seen', async ({ page, browserName }) => {
  await page.goto('/');
  const key = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  // The skip link, then the bar: the name stays out of the way until it shows.
  for (let stop = 1; stop <= 3; stop++) {
    await page.keyboard.press(key);
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const style = getComputedStyle(el);
      return { text: el.textContent?.trim(), seen: style.visibility === 'visible' && Number(style.opacity) > 0 };
    });
    expect(focused.seen, `tab stop ${stop} (${focused.text}) is invisible`).toBe(true);
  }
});

test('the name in the bar takes focus once it shows', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones hide the name in the bar');
  await page.goto('/');
  await page.locator('#about').scrollIntoViewIfNeeded();
  const name = page.locator('.bar-name');
  await expect(name).toHaveCSS('opacity', '1');
  await name.focus();
  await expect(name).toBeFocused();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the theme button is hidden, since it cannot work', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.theme-btn')).toBeHidden();
    await expect(page.locator('.bar-links a')).toHaveCount(6);
  });
});
