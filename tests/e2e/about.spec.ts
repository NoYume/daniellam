import { expect, test } from '@playwright/test';

test('about shows the lead and three paragraphs', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#about h2.about-lead')).toHaveText('I work where robot learning meets production AI software.');
  await expect(page.locator('#about .about-body p')).toHaveCount(3);
  await expect(page.locator('#about .about-body a')).toHaveAttribute('href', 'https://robin-lab.cs.utexas.edu/');
});

test('icon links are labeled and point to the right places', async ({ page }) => {
  await page.goto('/');
  const icons = page.locator('#about .id-icons a');
  await expect(icons).toHaveCount(4);
  const want = [
    ['Email', 'mailto:daniel.wingchi.lam@gmail.com'],
    ['GitHub', 'https://github.com/NoYume'],
    ['LinkedIn', 'https://www.linkedin.com/in/danielwlam'],
    ['Résumé', '/daniel-lam-resume.pdf'],
  ];
  for (const [i, [label, href]] of want.entries()) {
    await expect(icons.nth(i)).toHaveAttribute('aria-label', label);
    await expect(icons.nth(i)).toHaveAttribute('href', href);
    await expect(icons.nth(i).locator('svg')).toBeVisible();
  }
});

test('scholar icon is absent until a profile is set', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#about .id-icons a')).not.toHaveCount(0);
  await expect(page.locator('[aria-label="Google Scholar"]')).toHaveCount(0);
});

test('recent list keeps its order', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#about .news time')).toHaveText(['2026', 'Jun 2026', 'Jan 2026', 'Jan 2026']);
  await expect(page.locator('#about .news li').first()).toContainText('OopsieVerse accepted to RSS 2026.');
  await expect(page.locator('#about .news time').nth(1)).toHaveAttribute('datetime', '2026-06');
});

test('the headshot placeholder holds the 4:5 space', async ({ page }) => {
  await page.goto('/');
  const box = await page.locator('#about .headshot').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height / box!.width).toBeCloseTo(1.25, 2);
  await expect(page.locator('#about .role')).toHaveText(['Computer Science, UT Austin, May 2028', 'Research Assistant, RobIn Lab']);
});
