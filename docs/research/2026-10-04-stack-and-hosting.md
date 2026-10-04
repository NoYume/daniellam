# Stack and hosting facts (2026-10-04)

**Why this exists.** On 2026-10-04 Daniel asked to start implementation with Bun as the package manager, and said he was thinking of Render for hosting. Before recommending a stack, these facts were checked against official docs, pricing pages, npm and GitHub:
- A research agent gathered most of them.
- The Render bandwidth numbers, Last.fm's terms and Cloudflare's Bun support were rechecked directly afterwards.

## Render

**Static sites**
- Free to deploy, served from a "global CDN" (Cloudflare sits in front: Render's DDoS docs name it, and responses show `server: cloudflare`). https://render.com/docs/static-sites
- **Bandwidth is the catch.** Static sites count toward it.

  | Plan | Included per month |
  | --- | --- |
  | Hobby | 5 GB |
  | Pro | 25 GB |
  | Scale | 1 TB |

  - Overage: $0.15/GB.
  - Without a payment method, "Render spins down your workspace's services until the start of the next month."
  - Source: https://render.com/docs/outbound-bandwidth
- **Build minutes:** Hobby includes 500 a month, then $5 per 1,000.
- **Custom domains:** 2 included, then $0.25 per domain per month. TLS is free.
- **PR previews:** free for free static sites. https://render.com/docs/service-previews
- **Headers, redirects and rewrites:** set in the Dashboard or in `render.yaml` (`headers`, `routes`). https://render.com/docs/blueprint-spec
- **Default caching:** every file is sent with `cache-control: public, max-age=0, s-maxage=300`, including hashed JS and CSS (observed). A long-cache, immutable header rule is needed for `/_astro/*`.

**Free web services** (https://render.com/docs/free)
- They spin down after "15 minutes without receiving any inbound traffic", and spin-up "takes about one minute."
- 750 free instance hours per month.
- Render's advice: "Do not use them for production applications."
- The cheapest always-on instance is Starter: $7/month, 512 MB, 0.5 CPU.

**Bun**
- Native support: "Render natively supports Node.js / Bun." https://render.com/docs/language-support
- Bun is installed when a version is set, or when a `bun.lock` or `bun.lockb` exists. https://render.com/docs/bun-version
- Set the version with `BUN_VERSION` or a `.bun-version` file. The default is 1.4.2 for services created on or after 2026-09-09.
- The default Node is 24.21.0.

## Cloudflare

- **Static assets** on Workers and Pages are free and unlimited, with "no additional charges for data transfer (egress) or throughput (bandwidth)."
- **Workers free plan:** 100,000 requests a day, 10 ms of CPU per request. https://developers.cloudflare.com/workers/platform/pricing/
- **No cold starts:** Workers run in isolates, which "eliminates the cold starts of the virtual machine model." https://developers.cloudflare.com/workers/reference/how-workers-works/
- **Pages vs Workers:** the Pages docs now say "Start new projects with Workers." https://developers.cloudflare.com/pages/
- **Workers Builds:** Bun 1.2.15 is preinstalled, changeable with `BUN_VERSION`. Node 24.18.0, changeable with `NODE_VERSION`. https://developers.cloudflare.com/workers/ci-cd/builds/build-image/

## Astro

**Versions** (https://astro.build/blog/astro-7/)
- Astro 7.0.0 was released on 2026-06-22. "The .astro compiler has been rewritten in Rust."
- The latest stable release is 7.3.5 (2026-09-24).

**Upgrade notes that matter here** (https://docs.astro.build/en/guides/upgrade-to/v7/)
- Vite 8 with the Rolldown bundler.
- Unclosed tags are errors.
- `compressHTML` defaults to `'jsx'`, which removes whitespace between inline elements. Author lists need `{" "}`.
- Markdown defaults to the Sätteri processor. remark/rehype plugins need `@astrojs/markdown-remark`.
- SmartyPants stays on, so `--` and `---` in Markdown become en and em dashes. Turn it off: the site copy uses hyphens only.

**Open issues**
- withastro/astro#18054: the `glob()` loader swallows Markdown errors and the build still passes. Add a content check.
- withastro/astro#18214: an AVIF `<Picture>` comes out as HEIF, in the dev server only.

**Bun** (https://docs.astro.build/en/recipes/bun/)
- Astro's Bun page carries a caution: using the Bun runtime "may reveal rough edges. Some integrations may not work as expected."
- `bun run build` runs Astro on Node unless `--bun` is passed. https://bun.com/guides/ecosystem/astro
- Astro's `engines` field asks for Node >= 22.12.0.
- **Practical setup:** use Bun as the package manager and let Astro run on Node.

**Images**
- Astro's sharp image service never keeps metadata, so processed images lose their EXIF and GPS data.
- sharp supports Bun.
- Files in `public/` are copied as-is, so GPS data survives there. Keep photos in `src/assets/`.

**Fonts:** Astro's Fonts API has a `fontshare()` provider that downloads the fonts at build time. https://docs.astro.build/en/reference/font-provider-reference/

## Fonts: Fontshare licence

The ITF Free Font License, v2.0 (2026-08-17), covers Zodiak and Switzer. https://www.fontshare.com/licenses/itf-ffl
- **Allowed:** commercial use, and self-hosting through `@font-face` ("permitted and recommended").
- **Not allowed:**
  - modifying, subsetting or converting the files
  - redistributing them through a repository or public servers
- **What this means here:** `NoYume/daniellam` is public, so don't commit the font files. Let Astro's Fonts API fetch them at build time.

## Last.fm

- **Access:** `user.getRecentTracks` needs only an API key ("This service does not require authentication"). The live track carries `nowplaying="true"`. https://www.last.fm/api/show/user.getRecentTracks
- **CORS:** `access-control-allow-origin: *` was observed on error and preflight responses.
- **Terms** (https://www.last.fm/api/tos):
  - 2.7: use a "powered by AudioScrobbler" button that links back to Last.fm. Also: "You agree to only give public access to pages using Last.fm's web services that have been previously approved by Last.fm in writing."
  - 4.3.4: "implement suitable caching in accordance with the HTTP headers sent with web service responses."
  - 4.4: Last.fm sets and enforces limits at its own discretion. No numbers are published.
  - The API intro asks for an identifiable User-Agent, which a browser can't set.
- **What this means here:**
  - A small server-side endpoint with caching fits the terms better than calling Last.fm from the browser.
  - A public page needs Last.fm's written OK.

## Phosphor icons

- **Official raw SVGs:** `@phosphor-icons/core` (MIT, 2.1.1), at `@phosphor-icons/core/<weight>/*.svg`.
  - Imported as Astro SVG components, they are inlined at build time with no runtime script.
- There is no official Astro integration. A community option is `astro-icon` with `@iconify-json/ph`.

## This machine (2026-10-04)

- Installed: Bun 1.4.2, Node 26.10.0, uv.
- Missing: ffmpeg, which is needed later to re-encode the video loops.
