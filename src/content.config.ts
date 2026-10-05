import { defineCollection } from 'astro:content';
import { file, glob, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { LINE_ART_KEYS } from './lib/lineart-keys';

/**
 * Astro's file() loader, plus each entry's `position` in the file. Astro
 * returns entries sorted by id, and these lists show in file order
 * (read them with getOrdered from src/lib/content.ts).
 */
function orderedFile(fileName: string): Loader {
  const loader = file(fileName);
  return {
    ...loader,
    load: (context) => {
      let position = 0;
      return loader.load({
        ...context,
        parseData: (props) => context.parseData({ ...props, data: { ...props.data, position: position++ } }),
      });
    },
  };
}
const position = z.number();

const site = defineCollection({
  loader: file('src/content/site.yaml'),
  schema: z.object({
    name: z.string(),
    educationLine: z.string(),
    roleLines: z.array(z.string()),
    email: z.email(),
    links: z.object({
      github: z.url(),
      linkedin: z.url(),
      scholar: z.url().optional(),
      resume: z.string(),
    }),
    subtitles: z.object({ research: z.string(), experience: z.string(), projects: z.string(), shots: z.string() }),
    description: z.string(),
  }),
});

const about = defineCollection({
  loader: glob({ base: 'src/content', pattern: 'about.md' }),
  schema: ({ image }) =>
    z.object({
      lead: z.string(),
      headshot: image().optional(),
      headshotAlt: z.string().optional(),
      headshotCredit: z.string().optional(),
    }),
});

const recent = defineCollection({
  loader: orderedFile('src/content/recent.yaml'),
  schema: z.object({ position, date: z.coerce.string(), text: z.string(), link: z.url().optional() }),
});

const hero = defineCollection({
  loader: orderedFile('src/content/hero.yaml'),
  schema: z.object({
    position,
    file: z.string(),
    set: z.enum(['day', 'night']),
    place: z.string().optional(),
    photographer: z.string(),
    alt: z.string(),
  }),
});

const research = defineCollection({
  loader: glob({ base: 'src/content/research', pattern: '*.md' }),
  schema: ({ image }) =>
    z.object({
      order: z.number(),
      tag: z.string(),
      kind: z.string(),
      title: z.string(),
      authors: z
        .array(z.object({ name: z.string(), me: z.boolean().default(false), equal: z.boolean().default(false) }))
        .optional(),
      summary: z.string(),
      myPart: z.string().optional(),
      links: z
        .object({ paper: z.url().optional(), website: z.url().optional(), code: z.url().optional(), bibtex: z.string().optional() })
        .optional(),
      media: z.union([
        z.object({ art: z.enum(LINE_ART_KEYS), caption: z.string() }),
        z.object({ video: z.string(), poster: image(), caption: z.string() }),
        z.object({ image: image(), alt: z.string(), caption: z.string() }),
      ]),
      publication: z.object({ venue: z.string(), venueFull: z.string(), year: z.number() }).optional(),
    }),
});

const experience = defineCollection({
  loader: glob({ base: 'src/content/experience', pattern: '*.md' }),
  schema: z.object({
    order: z.number(),
    company: z.string(),
    role: z.string(),
    dates: z.string(),
    place: z.string(),
    summary: z.string(),
    bullets: z.array(z.string()).min(2).max(3),
    art: z.enum(LINE_ART_KEYS),
  }),
});

const projects = defineCollection({
  loader: orderedFile('src/content/projects.yaml'),
  schema: z.object({
    position,
    name: z.string(),
    description: z.string(),
    tech: z.array(z.string()),
    year: z.number(),
    link: z.url().optional(),
  }),
});

const shots = defineCollection({
  loader: orderedFile('src/content/shots.yaml'),
  schema: ({ image }) =>
    z.object({
      position,
      file: image(),
      alt: z.string(),
      place: z.string().optional(),
      date: z.coerce.string().optional(),
      caption: z.string().optional(),
      credit: z.string().optional(),
      mine: z.boolean().default(false),
      teaser: z.boolean().default(false),
    }),
});

export const collections = { site, about, recent, hero, research, experience, projects, shots };
