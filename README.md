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

The Shots page, at `/shots/`, and the row of photos on the homepage read from `src/content/shots.yaml`: one entry per trip, newest first. A photo enters the repo only through the photo script, which turns it upright, caps the long edge at 3000px and removes all metadata, GPS included. Give it a folder with one trip's photos and it prepares every JPEG and PNG in it, in name order, then prints a `photos:` block:

```bash
bun run photo photos/shots/tokyo shots/tokyo  # writes src/assets/shots/tokyo/ and prints the block
```

Paste the block under a new trip entry, fill in each `alt`, then add the trip's `id` (a lowercase slug such as `tokyo`, which becomes its link, `/shots/#tokyo`), `name`, `month` and `note`:

```yaml
- id: tokyo # a lowercase slug; the trip's link is /shots/#tokyo
  name: Tokyo # up to 24 characters
  month: 2026-03
  note: Rain most nights, so the trains did the work. # optional, up to 70 characters
  mine: true # my photos; a photo by someone else gets its own credit
  photos:
    - file: ../assets/shots/tokyo/shinjuku.jpg # the first photo is the cover, and must be landscape
      alt: Shinjuku street at night in the rain
      caption: Shinjuku on a rainy night # optional, up to 60 characters
      teaser: true # exactly four photos in all fill the homepage row
    - file: ../assets/shots/tokyo/alley.jpg
      alt: A narrow alley in the rain
      credit: A friend # a photo I didn't take
```

`mine: true` goes on a whole trip or on a single photo; a photo by anyone else takes a `credit` instead.

The same script adds hero photos (`bun run photo <file> hero`, then an entry in `hero.yaml`) and the headshot (`bun run photo <file> people headshot`, then `headshot` in `about.md`). Never put photos in `public/`: files there are served as they are, metadata and all.

## Contact

[danielwlam.com](https://www.danielwlam.com/) · daniel.wingchi.lam@gmail.com · [LinkedIn](https://linkedin.com/in/danielwlam)
