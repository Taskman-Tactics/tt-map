/** Stable Territory id from a display name (kebab-case ASCII slug). */
export function slugifyTerritoryName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Prefer `base`; if taken by another Territory, append -2, -3, …
 * `takenIds` should be the ids of all other Territories (not the one being named).
 */
export function uniqueTerritoryId(base: string, takenIds: Iterable<string>): string {
  const taken = new Set(takenIds);
  if (!taken.has(base)) {
    return base;
  }
  let n = 2;
  while (taken.has(`${base}-${n}`)) {
    n += 1;
  }
  return `${base}-${n}`;
}
