// The site's public address, used for canonical links, link previews, robots.txt
// and the sitemap. Read by astro.config.mjs.

/**
 * SITE_URL when set. A Cloudflare build (Workers Builds sets WORKERS_CI) without
 * it stops here: it would ship localhost links in every preview, silently.
 */
export function siteUrl(env: Record<string, string | undefined>): string {
  if (env.SITE_URL) return env.SITE_URL;
  if (env.WORKERS_CI) {
    throw new Error("SITE_URL is not set: add the site's address under the Worker's Settings > Build > Build variables and secrets");
  }
  return 'http://localhost:4321';
}
