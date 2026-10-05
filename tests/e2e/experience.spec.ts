import { expect, test } from '@playwright/test';

test('entries in order', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#experience .ex-co')).toHaveText([
    'Salesforce',
    'Lockheed Martin',
    'RobIn Lab, UT Austin',
    'Texas Robotics',
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
});

test('drawing follows the entry in the middle', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones show each entry with its own drawing (Task 15)');
  await page.goto('/');
  await expect(page.locator('#exArt svg')).toHaveCount(5);
  await expect(page.locator('#exArt svg:nth-of-type(1)')).toHaveAttribute('data-art', 'voice');
  await page.locator('.ex-entry[data-art="2"]').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(page.locator('#exArt svg:nth-of-type(3)')).toHaveClass(/\bon\b/);
  await expect(page.locator('#exArt svg:nth-of-type(3)')).toHaveAttribute('data-art', 'arm');
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
