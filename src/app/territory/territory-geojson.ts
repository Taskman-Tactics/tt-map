import type { Feature, FeatureCollection, Polygon, Position } from 'geojson';
import {
  BOARD_PIXEL_SNAP_ENABLED,
  lngLatToBoardPixelIndices,
  snapLngLatToBoardPixel,
} from '../board/board-pixel-snap';
import { simplifyPolygonCollinear } from '../board/board-polygon-simplify';

/** Stable Territory identity + display label (ADR-0002). */
export type TerritoryProperties = {
  id: string;
  name: string;
};

export type TerritoryFeature = Feature<Polygon, TerritoryProperties> & {
  id: string;
};

export type TerritoryCollection = FeatureCollection<Polygon, TerritoryProperties>;

export const TERRITORIES_GEOJSON_URL = '/territories.geojson';

export const EMPTY_TERRITORIES: TerritoryCollection = {
  type: 'FeatureCollection',
  features: [],
};

/** Origin Territory ids that are absent from the local draft (non-empty ids only). */
export function originTerritoryIdsNotInLocal(
  origin: TerritoryCollection,
  local: TerritoryCollection,
): string[] {
  const localIds = new Set(
    local.features
      .map((feature) => feature.properties.id)
      .filter((id) => id !== ''),
  );
  return origin.features
    .map((feature) => feature.properties.id)
    .filter((id) => id !== '' && !localIds.has(id));
}

export type TerritoryEditStatus = 'original' | 'modified' | 'new';

type PixelVertex = { px: number; py: number };

function ringToCanonicalPixels(ring: Position[]): string {
  if (ring.length === 0) {
    return '';
  }
  const open = [...ring];
  const first = open[0]!;
  const last = open[open.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) {
    open.pop();
  }

  const pixels: PixelVertex[] = open.map(([lng, lat]) =>
    lngLatToBoardPixelIndices(lng, lat),
  );
  if (pixels.length === 0) {
    return '';
  }

  // Rotate so the lexicographically smallest vertex is first (ring start independent).
  let start = 0;
  for (let i = 1; i < pixels.length; i++) {
    const cur = pixels[i]!;
    const best = pixels[start]!;
    if (cur.px < best.px || (cur.px === best.px && cur.py < best.py)) {
      start = i;
    }
  }
  const rotated = [
    ...pixels.slice(start),
    ...pixels.slice(0, start),
  ];

  return rotated.map((p) => `${p.px},${p.py}`).join(';');
}

/** True when polygons match on the board pixel grid (ignores ring start index). */
export function polygonVerticesEqual(a: Polygon, b: Polygon): boolean {
  const left = snapPolygonToBoardPixels(a);
  const right = snapPolygonToBoardPixels(b);
  if (left.coordinates.length !== right.coordinates.length) {
    return false;
  }
  for (let i = 0; i < left.coordinates.length; i++) {
    if (
      ringToCanonicalPixels(left.coordinates[i]!) !==
      ringToCanonicalPixels(right.coordinates[i]!)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Classify a local Territory against origin:
 * - new: id absent from origin (or empty id)
 * - modified: same id, different vertices
 * - original: same id, same vertices
 */
export function classifyTerritoryEditStatus(
  id: string,
  geometry: Polygon,
  originById: ReadonlyMap<string, Feature<Polygon, TerritoryProperties>>,
): TerritoryEditStatus {
  if (!id) {
    return 'new';
  }
  const originFeature = originById.get(id);
  if (!originFeature) {
    return 'new';
  }
  return polygonVerticesEqual(geometry, originFeature.geometry)
    ? 'original'
    : 'modified';
}

/** terra-draw requires `mode` on loaded features so they match PolygonMode. */
export type TerraDrawPolygonFeature = Feature<
  Polygon,
  { mode: 'polygon'; id: string; name: string }
>;

function samePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * terra-draw rejects polygons whose rings are not closed (first !== last).
 * MapLibre will still render unclosed rings, so the Viewer can look fine while
 * the Author tool silently drops the same Feature on addFeatures.
 */
export function closePolygonRings(geometry: Polygon): Polygon {
  return {
    type: 'Polygon',
    coordinates: geometry.coordinates.map((ring) => {
      if (ring.length === 0) {
        return ring;
      }
      const first = ring[0]!;
      const last = ring[ring.length - 1]!;
      if (samePosition(first, last)) {
        return ring;
      }
      return [...ring, first];
    }),
  };
}

/** Snap every ring vertex to a basemap texel, then ensure rings stay closed. */
export function snapPolygonToBoardPixels(geometry: Polygon): Polygon {
  const snapped: Polygon = {
    type: 'Polygon',
    coordinates: geometry.coordinates.map((ring) =>
      ring.map((position) => {
        const [lng, lat] = snapLngLatToBoardPixel(position[0], position[1]);
        return [lng, lat] as Position;
      }),
    ),
  };
  return closePolygonRings(snapped);
}

export function toTerraDrawFeatures(
  collection: TerritoryCollection,
): TerraDrawPolygonFeature[] {
  return collection.features.map((feature) => ({
    type: 'Feature',
    geometry: closePolygonRings(feature.geometry),
    properties: {
      mode: 'polygon',
      id: feature.properties.id,
      name: feature.properties.name,
    },
  }));
}

export function toTerritoryCollection(features: Feature[]): {
  collection: TerritoryCollection;
  missingIds: number;
} {
  const territories: TerritoryFeature[] = [];
  let missingIds = 0;

  for (const feature of features) {
    if (feature.geometry?.type !== 'Polygon') {
      continue;
    }

    const rawId = feature.properties?.['id'];
    const rawName = feature.properties?.['name'];
    if (typeof rawId !== 'string' || rawId.trim() === '') {
      missingIds += 1;
      continue;
    }

    const id = rawId.trim();
    const closedOrSnapped = BOARD_PIXEL_SNAP_ENABLED
      ? snapPolygonToBoardPixels(feature.geometry)
      : closePolygonRings(feature.geometry);
    territories.push({
      type: 'Feature',
      id,
      properties: {
        id,
        name: typeof rawName === 'string' ? rawName : '',
      },
      // Commit-time cleanup; live Author edits keep midpoints until dragged off-line.
      geometry: simplifyPolygonCollinear(closedOrSnapped),
    });
  }

  return {
    collection: { type: 'FeatureCollection', features: territories },
    missingIds,
  };
}

export function parseTerritoryCollection(data: unknown): TerritoryCollection {
  if (
    typeof data !== 'object' ||
    data === null ||
    (data as FeatureCollection).type !== 'FeatureCollection' ||
    !Array.isArray((data as FeatureCollection).features)
  ) {
    return EMPTY_TERRITORIES;
  }

  const { collection } = toTerritoryCollection(
    (data as FeatureCollection).features as Feature[],
  );
  return collection;
}

export function downloadTerritoryCollection(
  collection: TerritoryCollection,
  filename = 'territories.geojson',
): void {
  const blob = new Blob([JSON.stringify(collection, null, 2) + '\n'], {
    type: 'application/geo+json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Always bypass HTTP cache — Authors replace the static file frequently. */
export async function fetchTerritoryCollection(
  url: string = TERRITORIES_GEOJSON_URL,
): Promise<TerritoryCollection> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return parseTerritoryCollection(await response.json());
}
