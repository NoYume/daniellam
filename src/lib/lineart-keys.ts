/** The line drawings that exist. Content files name one of these. */
export const LINE_ART_KEYS = ['voice', 'hud', 'arm', 'tree', 'building', 'boat'] as const;
export type LineArtKey = (typeof LINE_ART_KEYS)[number];
