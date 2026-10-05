import { expect, test, type Page } from '@playwright/test';

const LIGHT_BG = 'rgb(243, 243, 241)';
const DARK_BG = 'rgb(14, 15, 17)';

test.describe('with a light system setting', () => {
  test.use({ colorScheme: 'light' });

  test('first visit follows a light system setting', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
    await expect(page.locator('html')).toHaveCSS('background-color', LIGHT_BG);
  });
});

test.describe('with a dark system setting', () => {
  test.use({ colorScheme: 'dark' });

  test('first visit follows a dark system setting', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await expect(page.locator('html')).toHaveCSS('background-color', DARK_BG);
  });

  test('a saved choice wins over the system', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('mode', 'light'));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
    await expect(page.locator('html')).toHaveCSS('background-color', LIGHT_BG);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, colorScheme: 'light' });

  test('without JavaScript the colors follow the system', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveCSS('background-color', LIGHT_BG);
  });
});

test('fonts are self-hosted', async ({ page, baseURL }) => {
  const fonts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font' || /fonts\.googleapis\.com|fonts\.gstatic\.com|fontshare\.com/.test(request.url())) {
      fonts.push(request.url());
    }
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.filter((url) => !url.startsWith(`${baseURL}/`))).toEqual([]);
});

test.describe('loading in dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('the first frame is already dark, with no fade from white', async ({ page }) => {
    await page.addInitScript(() => {
      requestAnimationFrame(() => {
        const style = getComputedStyle(document.documentElement);
        (window as unknown as { __first: string[] }).__first = [style.backgroundColor, style.color];
      });
    });
    await page.goto('/');
    expect(await page.evaluate(() => (window as unknown as { __first: string[] }).__first)).toEqual(['rgb(14, 15, 17)', 'rgb(240, 241, 242)']);
  });

  test('links and buttons start in their final colors', async ({ page }) => {
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () =>
        requestAnimationFrame(() => {
          const link = document.querySelector('.bar-links a')!;
          (window as unknown as { __link: string }).__link = getComputedStyle(link).color;
        }),
      );
    });
    await page.goto('/nope');
    const first = await page.waitForFunction(() => (window as unknown as { __link?: string }).__link);
    expect(await first.jsonValue()).toBe('rgb(201, 204, 209)');
  });

  test('switching modes still fades the colors over .4s', async ({ page }) => {
    await page.goto('/');
    const duration = () => page.evaluate(() => getComputedStyle(document.documentElement).transitionDuration);
    expect(await duration()).not.toContain('0.4s');
    await page.locator('.theme-btn').click();
    expect(await duration()).toContain('0.4s');
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(243, 243, 241)');
  });
});

// Spec 6.1 as plain values. Tokens written with light-dark() leave every color
// unset in browsers without it (Safari before 17.5, Chrome before 123).
const TOKENS = {
  dark: {
    '--bg': '#0e0f11', '--surface': '#15171a', '--stripe': '#181a1e', '--line': '#24272b', '--line-2': '#30343a',
    '--text': '#f0f1f2', '--text-2': '#c9ccd1', '--muted': '#979ba2', '--faint': '#6a6e75', '--hi': '#f5f6f7',
    '--acc': '#8faad0', '--g1': '#3e5779', '--g2': '#6f8fba', '--g3': '#afc4e0',
    '--pg-body': '#8a9099', '--pg-belly': '#f0f1f2', '--pg-beak': '#b9ae9c',
  },
  light: {
    '--bg': '#f3f3f1', '--surface': '#e9eae8', '--stripe': '#e1e2e0', '--line': '#dadbda', '--line-2': '#c9cbcb',
    '--text': '#141518', '--text-2': '#383b40', '--muted': '#676b73', '--faint': '#92969d', '--hi': '#121316',
    '--acc': '#3e5f8a', '--g1': '#22334d', '--g2': '#3e5f8a', '--g3': '#7e9cc2',
    '--pg-body': '#3b3f46', '--pg-belly': '#ffffff', '--pg-beak': '#8f8676',
  },
};

async function tokens(page: Page): Promise<Record<string, string>> {
  return page.evaluate((names) => {
    const style = getComputedStyle(document.documentElement);
    // The CSS minifier may shorten #ffffff to #fff.
    const long = (value: string) => value.replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/, '#$1$1$2$2$3$3');
    return Object.fromEntries(names.map((name) => [name, long(style.getPropertyValue(name).trim().toLowerCase())]));
  }, Object.keys(TOKENS.dark));
}

for (const mode of ['light', 'dark'] as const) {
  const other = mode === 'light' ? 'dark' : 'light';

  test.describe(`tokens with a ${mode} system setting`, () => {
    test.use({ colorScheme: mode });

    test(`${mode} mode's tokens are plain colors`, async ({ page }) => {
      await page.goto('/');
      expect(await tokens(page)).toEqual(TOKENS[mode]);
    });

    test(`a saved ${other} choice gets the ${other} tokens`, async ({ page }) => {
      await page.addInitScript((saved) => localStorage.setItem('mode', saved), other);
      await page.goto('/');
      expect(await tokens(page)).toEqual(TOKENS[other]);
    });
  });

  test.describe(`tokens without JavaScript, with a ${mode} system setting`, () => {
    test.use({ javaScriptEnabled: false, colorScheme: mode });

    test(`without JavaScript a ${mode} system gets the ${mode} tokens`, async ({ page }) => {
      await page.goto('/');
      expect(await tokens(page)).toEqual(TOKENS[mode]);
    });
  });
}
