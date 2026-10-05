// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import { siteUrl } from './scripts/lib/site-url';

export default defineConfig({
  site: siteUrl(process.env),
  output: 'static',
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
  // Keep the spaces between inline elements (Astro 7 defaults to 'jsx').
  compressHTML: true,
  markdown: {
    // Hyphens only: never turn -- or --- into dashes.
    processor: satteri({ features: { smartPunctuation: false } }),
  },
  vite: {
    build: {
      // Astro builds for esnext, which leaves the CSS minifier without browser
      // targets: it then keeps only the last of backdrop-filter and its
      // -webkit- twin. These are Vite's own defaults (Baseline widely available).
      cssTarget: ['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4'],
    },
  },
  // Downloaded at build time and served from this site. Fontshare's licence
  // forbids committing or subsetting Zodiak and Switzer, so they stay whole.
  fonts: [
    {
      provider: fontProviders.fontshare(),
      name: 'Zodiak',
      cssVariable: '--font-serif',
      weights: [400],
      styles: ['normal'],
      fallbacks: ['Georgia', 'serif'],
    },
    {
      provider: fontProviders.fontshare(),
      name: 'Switzer',
      cssVariable: '--font-sans',
      weights: [400, 500, 600],
      styles: ['normal'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'JetBrains Mono',
      cssVariable: '--font-mono',
      weights: [400, 500],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
    {
      // The ten label characters only; fetched by scripts/fonts-cjk.ts.
      provider: fontProviders.local(),
      name: 'Noto Serif TC Labels',
      cssVariable: '--font-cjk',
      options: {
        variants: [{ src: ['./src/generated/fonts/noto-serif-tc-labels.woff2'], weight: 500, style: 'normal' }],
      },
      fallbacks: [],
    },
  ],
});
