import { expect, test, type Page } from '@playwright/test';

test('entries in order', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#experience .ex-co')).toHaveText([
    'Salesforce',
    'Lockheed Martin',
    'RobIn Lab, UT Austin',
    'Texas Robotics',
    'Texas Marine Robotics',
    'Sustainable Building Initiative',
  ]);
});

test('meta line and bullets', async ({ page }) => {
  await page.goto('/');
  const first = page.locator('#experience .ex-entry').first();
  await expect(first.locator('.ex-meta span')).toHaveText(['Software Engineer Intern, Agentforce', 'Jun - Aug 2026', 'San Francisco']);
  await expect(first.locator('.ex-desc')).toHaveText('Voice and multi-agent planning for Agentforce.');
  await expect(first.locator('.ex-list li')).toHaveCount(3);
  await expect(page.locator('#experience .ex-entry').nth(3).locator('.ex-list li')).toHaveCount(2);
  const tmr = page.locator('#experience .ex-entry').nth(4);
  await expect(tmr.locator('.ex-meta span')).toHaveText(['Lead Simulation Engineer', 'Jan 2026 - now', 'Austin']);
  await expect(tmr.locator('.ex-desc')).toHaveText("Leading the team's buoy detection for RoboBoat 2027.");
  await expect(tmr.locator('.ex-list li')).toHaveCount(2);
});

test('drawing follows the entry in the middle', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones show each entry with its own drawing (Task 15)');
  await page.goto('/');
  await expect(page.locator('#exArt svg')).toHaveCount(6);
  await expect(page.locator('#exArt svg:nth-of-type(1)')).toHaveAttribute('data-art', 'voice');
  await page.locator('.ex-entry[data-art="2"]').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(page.locator('#exArt svg:nth-of-type(3)')).toHaveClass(/\bon\b/);
  await expect(page.locator('#exArt svg:nth-of-type(3)')).toHaveAttribute('data-art', 'pour');
  await expect(page.locator('#exArt svg.on')).toHaveCount(1);
  await page.locator('.ex-entry[data-art="4"]').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(page.locator('#exArt svg:nth-of-type(5)')).toHaveClass(/\bon\b/);
  await expect(page.locator('#exArt svg:nth-of-type(5)')).toHaveAttribute('data-art', 'boat');
  await expect(page.locator('#exArt svg.on')).toHaveCount(1);
});

test('line art pauses off-screen', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones show each entry with its own drawing (Task 15)');
  await page.goto('/');
  const art = page.locator('#exArt svg').first();
  await expect(art).toHaveClass(/\bla-paused\b/);
  await page.locator('.ex-entry').first().evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(art).not.toHaveClass(/\bla-paused\b/);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(art).toHaveClass(/\bla-paused\b/);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('reduced motion stops the flow', async ({ page }) => {
    await page.goto('/');
    const flow = page.locator('#exArt .la-flow').first();
    await expect(flow).toHaveCount(1);
    expect(await flow.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  });
});

const fillOf = (page: Page) =>
  page.locator('svg[data-art="pour"] path[style*="--la-bg"]').first().evaluate((el) => getComputedStyle(el).fill);
const pageBg = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

for (const mode of ['dark', 'light'] as const) {
  test(`fills match the page background in ${mode} mode`, async ({ page }) => {
    await page.addInitScript((m) => localStorage.setItem('mode', m), mode);
    await page.goto('/');
    expect(await fillOf(page)).toBe(await pageBg(page));
  });
}

test('fills transition with the page while the mode switches', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.documentElement.classList.add('mode-switch'));
  const t = await page.locator('svg[data-art="pour"] path[style*="--la-bg"]').first()
    .evaluate((el) => [getComputedStyle(el).transitionProperty, getComputedStyle(el).transitionDuration]);
  expect(t).toEqual(['fill', '0.4s']);
});

test.describe('under forced colors', () => {
  test.use({ colorScheme: 'light' });

  test('under forced colors, fills match the forced page background', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'forced colors emulation is Chromium only');
    await page.addInitScript(() => localStorage.setItem('mode', 'dark'));
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/');
    const [fill, bg] = [await fillOf(page), await pageBg(page)];
    expect(fill).toBe(bg);
    expect(fill).not.toBe('rgb(14, 15, 17)');
  });
});
