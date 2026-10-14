import { describe, expect, it } from 'vitest';
import { boardPixelIndicesToLngLat } from '../board/board-pixel-snap';
import {
  classifyTerritoryEditStatus,
  closePolygonRings,
  originTerritoryIdsNotInLocal,
  parseTerritoryCollection,
  polygonVerticesEqual,
  toTerraDrawFeatures,
  toTerritoryCollection,
  type TerritoryCollection,
  type TerritoryFeature,
} from './territory-geojson';

function territoryCollection(
  ids: string[],
): TerritoryCollection {
  return {
    type: 'FeatureCollection',
    features: ids.map((id) => ({
      type: 'Feature',
      id,
      properties: { id, name: id },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
    })),
  };
}

describe('territory-geojson', () => {
  it('exports Feature.id matching properties.id and drops undrawable junk', () => {
    const { collection, missingIds } = toTerritoryCollection([
      {
        type: 'Feature',
        properties: { mode: 'polygon', id: ' alaska ', name: 'Alaska' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { mode: 'polygon', name: 'No id' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [2, 2],
              [3, 2],
              [3, 3],
              [2, 2],
            ],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { mode: 'point' },
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
    ]);

    expect(missingIds).toBe(1);
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0]?.id).toBe('alaska');
    expect(collection.features[0]?.properties).toEqual({
      id: 'alaska',
      name: 'Alaska',
    });
  });

  it('round-trips into terra-draw polygon features', () => {
    const loaded = parseTerritoryCollection({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'brazil',
          properties: { id: 'brazil', name: 'Brazil' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ],
          },
        },
      ],
    });

    expect(toTerraDrawFeatures(loaded)).toEqual([
      {
        type: 'Feature',
        geometry: loaded.features[0]?.geometry,
        properties: { mode: 'polygon', id: 'brazil', name: 'Brazil' },
      },
    ]);
  });

  it('closes unclosed rings so terra-draw can load Author exports MapLibre still shows', () => {
    const unclosed = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [16.35, 10.31],
          [16.35, 10.2],
          [16.4, 10.2],
        ],
      ],
    };

    const closed = closePolygonRings(unclosed);
    const ring = closed.coordinates[0]!;
    expect(ring[0]).toEqual([16.35, 10.31]);
    expect(ring[ring.length - 1]).toEqual([16.35, 10.31]);

    const features = toTerraDrawFeatures(
      parseTerritoryCollection({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'gravewater',
            properties: { id: 'gravewater', name: 'Gravewater' },
            geometry: unclosed,
          },
        ],
      }),
    );

    const loadedRing = features[0]!.geometry.coordinates[0]!;
    expect(loadedRing[0]).toEqual(loadedRing[loadedRing.length - 1]);
  });

  it('lists origin Territory ids missing from the local draft', () => {
    expect(
      originTerritoryIdsNotInLocal(
        territoryCollection(['alaska', 'brazil', 'chile']),
        territoryCollection(['brazil']),
      ),
    ).toEqual(['alaska', 'chile']);

    expect(
      originTerritoryIdsNotInLocal(
        territoryCollection(['alaska']),
        territoryCollection(['alaska', 'brazil']),
      ),
    ).toEqual([]);
  });

  it('treats rotated rings as equal vertices', () => {
    const a = {
      type: 'Polygon' as const,
      coordinates: [
        [
          boardPixelIndicesToLngLat(0, 0),
          boardPixelIndicesToLngLat(3, 0),
          boardPixelIndicesToLngLat(3, 2),
          boardPixelIndicesToLngLat(0, 2),
          boardPixelIndicesToLngLat(0, 0),
        ],
      ],
    };
    const b = {
      type: 'Polygon' as const,
      coordinates: [
        [
          boardPixelIndicesToLngLat(3, 2),
          boardPixelIndicesToLngLat(0, 2),
          boardPixelIndicesToLngLat(0, 0),
          boardPixelIndicesToLngLat(3, 0),
          boardPixelIndicesToLngLat(3, 2),
        ],
      ],
    };
    expect(polygonVerticesEqual(a, b)).toBe(true);
  });

  it('classifies local Territories against origin', () => {
    const originGeom = {
      type: 'Polygon' as const,
      coordinates: [
        [
          boardPixelIndicesToLngLat(0, 0),
          boardPixelIndicesToLngLat(2, 0),
          boardPixelIndicesToLngLat(2, 2),
          boardPixelIndicesToLngLat(0, 0),
        ],
      ],
    };
    const movedGeom = {
      type: 'Polygon' as const,
      coordinates: [
        [
          boardPixelIndicesToLngLat(0, 0),
          boardPixelIndicesToLngLat(4, 0),
          boardPixelIndicesToLngLat(2, 2),
          boardPixelIndicesToLngLat(0, 0),
        ],
      ],
    };
    const originFeature: TerritoryFeature = {
      type: 'Feature',
      id: 'alaska',
      properties: { id: 'alaska', name: 'Alaska' },
      geometry: originGeom,
    };
    const originById = new Map([['alaska', originFeature]]);

    expect(classifyTerritoryEditStatus('alaska', originGeom, originById)).toBe(
      'original',
    );
    expect(classifyTerritoryEditStatus('alaska', movedGeom, originById)).toBe(
      'modified',
    );
    expect(classifyTerritoryEditStatus('brazil', originGeom, originById)).toBe(
      'new',
    );
    expect(classifyTerritoryEditStatus('', originGeom, originById)).toBe('new');
  });
});
