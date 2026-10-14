import { describe, expect, it } from 'vitest';
import {
  clearLocalTerritoryCollection,
  loadLocalFillOpacity,
  loadLocalTerritoryCollection,
  saveLocalFillOpacity,
  saveLocalTerritoryCollection,
  snapshotToDraftCollection,
  TERRITORIES_FILL_OPACITY_STORAGE_KEY,
  TERRITORIES_LOCAL_STORAGE_KEY,
} from './territory-local-storage';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe('territory-local-storage', () => {
  it('keeps unnamed draft polygons in the snapshot', () => {
    const collection = snapshotToDraftCollection([
      {
        type: 'Feature',
        properties: { mode: 'polygon', id: '', name: '' },
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
    ]);

    expect(collection.features).toHaveLength(1);
    expect(collection.features[0]?.properties).toEqual({ id: '', name: '' });
  });

  it('round-trips a draft through Storage', () => {
    const storage = memoryStorage();
    const collection = snapshotToDraftCollection([
      {
        type: 'Feature',
        properties: { mode: 'polygon', id: 'alaska', name: 'Alaska' },
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
    ]);

    saveLocalTerritoryCollection(collection, storage);
    expect(storage.getItem(TERRITORIES_LOCAL_STORAGE_KEY)).toBeTruthy();

    const loaded = loadLocalTerritoryCollection(storage);
    expect(loaded?.features).toHaveLength(1);
    expect(loaded?.features[0]?.properties).toEqual({
      id: 'alaska',
      name: 'Alaska',
    });

    clearLocalTerritoryCollection(storage);
    expect(loadLocalTerritoryCollection(storage)).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    const storage = memoryStorage();
    storage.setItem(TERRITORIES_LOCAL_STORAGE_KEY, '{not-json');
    expect(loadLocalTerritoryCollection(storage)).toBeNull();
  });

  it('round-trips fill opacity through Storage', () => {
    const storage = memoryStorage();
    expect(loadLocalFillOpacity(storage)).toBeNull();

    saveLocalFillOpacity(0.42, storage);
    expect(storage.getItem(TERRITORIES_FILL_OPACITY_STORAGE_KEY)).toBe('0.42');
    expect(loadLocalFillOpacity(storage)).toBe(0.42);
  });

  it('clamps fill opacity and rejects non-numeric values', () => {
    const storage = memoryStorage();

    saveLocalFillOpacity(1.5, storage);
    expect(loadLocalFillOpacity(storage)).toBe(1);

    saveLocalFillOpacity(-0.2, storage);
    expect(loadLocalFillOpacity(storage)).toBe(0);

    storage.setItem(TERRITORIES_FILL_OPACITY_STORAGE_KEY, 'nope');
    expect(loadLocalFillOpacity(storage)).toBeNull();
  });
});
