# Daniel Lam

Computer Science, The University of Texas at Austin. BS expected May 2028.

I work where robot learning meets production AI software: research at the RobIn Lab, and AI engineering at Salesforce and Lockheed Martin.

This is my personal website, built as a static Astro site with film-graded city photos in the hero and served by Cloudflare Workers.

## Development

```bash
bun install
bun run dev
```

The local site runs at `http://localhost:4321`. It needs Bun 1.4.2 and Node 22.12 or later, which Astro runs on. Before starting, `dev` and `build` check the content, fetch the Chinese label font, bake the hero photos and draw the link preview image.

## Commands

```bash
bun run check      # TypeScript and Astro checks
bun run test       # unit tests
bun run e2e        # browser tests at laptop and phone sizes, in Chromium and WebKit
bun run build      # production build, in dist/
bun run preview    # serves dist/ at http://localhost:4321
bunx lhci autorun  # Lighthouse phone budgets on dist/ (needs Chrome)
```

Content lives in `src/content`, photos in `src/assets`, application code in `src`, and public files in `public`. The build stops on content that breaks a rule: an en or em dash, a photo without alt text or credit, or a photo that still carries metadata. The browser tests need Playwright's browsers once: `bunx playwright install chromium webkit`. GitHub Actions runs all of these on every push.

## Listening feed

Not built yet. The now-playing line in the hero comes with the music phase, from a small Cloudflare Worker route, so the site itself stays static. Spotify is the source; whether the Worker reads it directly or through Last.fm is still open.

## Shots photos

The Shots page (coming later) and the row of photos on the homepage read from `src/content/shots.yaml`. A photo enters the repo only through the photo script, which turns it upright, caps the long edge at 3000px and removes all metadata, GPS included:

```bash
bun run photo ~/Pictures/ferry.jpg shots ferry  # writes src/assets/shots/ferry.jpg
```

Then add it to `shots.yaml`:

```yaml
- id: ferry
  file: ../assets/shots/ferry.jpg
  alt: Morning ferry crossing the harbor
  place: Hong Kong # optional, like date and caption
  mine: true # my own photo; anyone else's needs a credit instead
  teaser: true # shows it in the homepage row, which fits four
```

The same script adds hero photos (`bun run photo <file> hero`, then an entry in `hero.yaml`) and the headshot (`bun run photo <file> people headshot`, then `headshot` in `about.md`). Never put photos in `public/`: files there are served as they are, metadata and all.

## Contact

[danielwlam.com](https://www.danielwlam.com/) · daniel.wingchi.lam@gmail.com · [LinkedIn](https://linkedin.com/in/danielwlam)
