import { execFileSync } from 'node:child_process';

export interface ShotPhoto { alt: string; caption?: string; credit?: string; mine?: boolean; teaser?: boolean }
export interface ShotTrip { id: string; name: string; month: string; note?: string; mine?: boolean; photos: ShotPhoto[] }

/** The trips in src/content/shots.yaml, in file order, so the tests follow whatever trips are there. */
export const TRIPS: ShotTrip[] = JSON.parse(
  execFileSync('bun', ['-e', "process.stdout.write(JSON.stringify(Bun.YAML.parse(await Bun.file('src/content/shots.yaml').text())))"], { encoding: 'utf8' }),
);
export const PHOTO_COUNT = TRIPS.reduce((n, t) => n + t.photos.length, 0);
