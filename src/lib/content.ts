import { getCollection, type CollectionEntry } from 'astro:content';

type Ordered = 'hero' | 'recent' | 'projects' | 'shots';

/** A list collection's entries in the order they appear in its YAML file. */
export async function getOrdered<C extends Ordered>(collection: C): Promise<CollectionEntry<C>[]> {
  const entries = (await getCollection(collection)) as CollectionEntry<C>[];
  return entries.sort((a, b) => a.data.position - b.data.position);
}
