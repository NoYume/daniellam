import { expect, test } from '@playwright/test';

test('author list keeps its spaces', async ({ page }) => {
  await page.goto('/');
  const authors = page.locator('#research .rs-authors').first();
  expect(await authors.evaluate((el) => el.textContent)).toBe(
    'Arnav Balaji*, Arpit Bahety*, Sriniket Ambatipudi, Daniel Lam, Junhong Xu, Roberto Martín-Martín',
  );
  await expect(authors.locator('b')).toHaveText('Daniel Lam');
});

test('publication row', async ({ page }) => {
  await page.goto('/');
  const pub = page.locator('#research .pub');
  await expect(pub).toHaveCount(1);
  await expect(pub.locator('.venue')).toHaveText('RSS 2026');
  await expect(pub).toContainText('OopsieVerse: A Safety Benchmark with Damage-Aware Simulation for Robot Manipulation.');
  await expect(pub).toContainText('A. Balaji*, A. Bahety*, S. Ambatipudi, D. Lam, J. Xu, R. Martín-Martín.');
  await expect(pub).toContainText('Robotics: Science and Systems, 2026.');
  await expect(pub).toContainText('* equal contribution');
  await expect(pub.locator('b')).toHaveText('D. Lam');
  await expect(pub.locator('.links a')).toHaveText(['Paper', 'Website', 'Code']);
  await expect(pub.locator('.links a').first()).toHaveAttribute('href', 'https://arxiv.org/abs/2606.31993');
});

test('my part callout', async ({ page }) => {
  await page.goto('/');
  const first = page.locator('#research .rs-entry').first();
  await expect(first.locator('.rs-role')).toContainText('Led the RoboCasa implementation');
  await expect(first.locator('.rs-tags')).toHaveText(/RSS 2026\s*Paper/);
  await expect(first.locator('.rs-links a')).toHaveText(['Paper ↗', 'Website ↗', 'Code ↗']);
});

test('entries are in order, without empty parts', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#research .rs-title')).toHaveText([
    'OopsieVerse: A Safety Benchmark with Damage-Aware Simulation for Robot Manipulation',
    'A real-time damage HUD for safer demonstrations',
    'Synthetic buoy data for RoboBoat 2027',
  ]);
  // The RoboBoat entry has no authors, part or links, so none of those render.
  const last = page.locator('#research .rs-entry').last();
  await expect(last.locator('.rs-authors, .rs-role, .rs-links')).toHaveCount(0);
});

test('pinned panel follows the entry in the middle', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones show each entry with its own media (Task 15)');
  await page.goto('/');
  await expect(page.locator('#rsMedia > :nth-child(1)')).toHaveClass(/\bon\b/);
  await expect(page.locator('#rsCap')).toHaveText('Robot arm and its trajectory.');
  await page.locator('.rs-entry[data-media="1"]').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(page.locator('#rsMedia > :nth-child(2)')).toHaveClass(/\bon\b/);
  await expect(page.locator('#rsMedia > :nth-child(1)')).not.toHaveClass(/\bon\b/);
  await expect(page.locator('#rsCap')).toHaveText('Heads-up display.');
  await expect(page.locator('#rsMedia > :nth-child(2) svg[data-art="hud"]')).toBeVisible();
});
