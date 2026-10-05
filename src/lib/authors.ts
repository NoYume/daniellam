/** Citation style: every given name becomes an initial. 'Roberto Martín-Martín' → 'R. Martín-Martín'. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts.pop()!;
  return [...parts.map((part) => `${part[0]}.`), last].join(' ');
}
