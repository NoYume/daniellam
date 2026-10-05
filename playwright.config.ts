import { defineConfig, devices } from '@playwright/test';

const desktop = { viewport: { width: 1440, height: 900 } };
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4322' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], ...desktop, browserName: 'chromium' } },
    { name: 'phone-chromium', use: { ...devices['Pixel 7'], ...phone, browserName: 'chromium' } },
    { name: 'desktop-webkit', use: { ...devices['Desktop Safari'], ...desktop, browserName: 'webkit' } },
    { name: 'phone-webkit', use: { ...devices['iPhone 15'], ...phone, browserName: 'webkit' } },
  ],
  webServer: {
    // A port of its own: a `bun run dev` on 4321 would otherwise be reused and
    // tested in place of the build. --ignore-lock keeps the server in the
    // foreground: Astro 7 otherwise moves `astro preview` to the background
    // when an AI agent runs it.
    command: 'bun run build && bun run preview --port 4322 --ignore-lock',
    port: 4322,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
