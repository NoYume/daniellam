import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { pinRandom } from './helpers';

/** Serious and critical axe violations, one line per failing node. */
async function seriousViolations(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} ${n.failureSummary ?? ''}`));
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`in ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test('homepage has no serious or critical axe violations', async ({ page }) => {
      await pinRandom(page);
      await page.goto('/');
      await expect(page.locator('.hero-media .hero-photo img')).toHaveCSS('opacity', '1');
      expect(await seriousViolations(page)).toEqual([]);
    });

    test('404 has no serious or critical axe violations', async ({ page }) => {
      await page.goto('/nope');
      expect(await seriousViolations(page)).toEqual([]);
    });
  });
}
