import type { Feature, FeatureCollection } from 'geojson';
import {
  closePolygonRings,
  type TerritoryCollection,
  type TerritoryFeature,
} from './territory-geojson';

/** Browser draft of in-progress Author edits (ADR-0002 static file is still the commit target). */
export const TERRITORIES_LOCAL_STORAGE_KEY = 'tt-map.territories.draft';

/** Author UI preference: fill opacity for Territory drawings (0–1). */
export const TERRITORIES_FILL_OPACITY_STORAGE_KEY =
  'tt-map.territories.fill-opacity';

function browserStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
}

function clampFillOpacity(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Persist every polygon, including unnamed drafts — `toTerritoryCollection` drops
 * those, which would make local recovery lose work-in-progress shapes.
 */
export function snapshotToDraftCollection(
  features: Feature[],
): TerritoryCollection {
  const territories: TerritoryFeature[] = [];

  for (const feature of features) {
    if (feature.geometry?.type !== 'Polygon') {
      continue;
    }

    const rawId = feature.properties?.['id'];
    const rawName = feature.properties?.['name'];
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    const name = typeof rawName === 'string' ? rawName : '';

    territories.push({
      type: 'Feature',
      id: id || `draft-${territories.length}`,
      properties: { id, name },
      geometry: closePolygonRings(feature.geometry),
    });
  }

  return { type: 'FeatureCollection', features: territories };
}

export function loadLocalTerritoryCollection(
  storage: Storage | null = browserStorage(),
): TerritoryCollection | null {
  if (!storage) {
    return null;
  }

  let raw: string | null;
  try {
    raw = storage.getItem(TERRITORIES_LOCAL_STORAGE_KEY);
  } catch {
    return null;
  }

  if (raw === null || raw === '') {
    return null;
  }

  try {
    const data: unknown = JSON.parse(raw);
    if (
      typeof data !== 'object' ||
      data === null ||
      (data as FeatureCollection).type !== 'FeatureCollection' ||
      !Array.isArray((data as FeatureCollection).features)
    ) {
      return null;
    }

    return snapshotToDraftCollection(
      (data as FeatureCollection).features as Feature[],
    );
  } catch {
    return null;
  }
}

export function saveLocalTerritoryCollection(
  collection: TerritoryCollection,
  storage: Storage | null = browserStorage(),
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(
      TERRITORIES_LOCAL_STORAGE_KEY,
      JSON.stringify(collection),
    );
  } catch {
    // Quota / private mode — Author can still Download; draft just won't survive reload.
  }
}

export function clearLocalTerritoryCollection(
  storage: Storage | null = browserStorage(),
): void {
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(TERRITORIES_LOCAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Returns a clamped 0–1 opacity, or null when unset / invalid. */
export function loadLocalFillOpacity(
  storage: Storage | null = browserStorage(),
): number | null {
  if (!storage) {
    return null;
  }

  let raw: string | null;
  try {
    raw = storage.getItem(TERRITORIES_FILL_OPACITY_STORAGE_KEY);
  } catch {
    return null;
  }

  if (raw === null || raw === '') {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return clampFillOpacity(parsed);
}

export function saveLocalFillOpacity(
  opacity: number,
  storage: Storage | null = browserStorage(),
): void {
  if (!storage || !Number.isFinite(opacity)) {
    return;
  }
  try {
    storage.setItem(
      TERRITORIES_FILL_OPACITY_STORAGE_KEY,
      String(clampFillOpacity(opacity)),
    );
  } catch {
    // Quota / private mode — slider still works for the session.
  }
}
