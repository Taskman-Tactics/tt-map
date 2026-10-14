import {
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import {
  ControlComponent,
  ImageSourceComponent,
  LayerComponent,
  MapComponent,
  NavigationControlDirective,
} from '@maplibre/ngx-maplibre-gl';
import {
  LngLatBounds,
  type FitBoundsOptions,
  type Map as MapLibreMap,
  type RasterLayerSpecification,
  type StyleSpecification,
} from 'maplibre-gl';
import type { Feature, Polygon, Position } from 'geojson';
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import {
  BOARD_BOUNDS,
  BOARD_IMAGE_COORDINATES,
  BOARD_MAX_BOUNDS,
} from '../board/board-coordinates';
import {
  BOARD_COORDINATE_DECIMALS,
  BOARD_PIXEL_SNAP_ENABLED,
  snapLngLatToBoardPixel,
} from '../board/board-pixel-snap';
import { simplifyPolygonCollinear } from '../board/board-polygon-simplify';
import {
  classifyTerritoryEditStatus,
  downloadTerritoryCollection,
  fetchTerritoryCollection,
  originTerritoryIdsNotInLocal,
  snapPolygonToBoardPixels,
  toTerraDrawFeatures,
  toTerritoryCollection,
  type TerritoryCollection,
  type TerritoryEditStatus,
  type TerritoryProperties,
} from './territory-geojson';
import { slugifyTerritoryName, uniqueTerritoryId } from './territory-id';
import {
  clearLocalTerritoryCollection,
  loadLocalTerritoryCollection,
  saveLocalTerritoryCollection,
  snapshotToDraftCollection,
} from './territory-local-storage';

/** Snap draw/edit pointers onto basemap texels (Mercator-correct UV). */
const boardPixelSnapping = BOARD_PIXEL_SNAP_ENABLED
  ? {
      toCustom: (event: { lng: number; lat: number }) =>
        snapLngLatToBoardPixel(event.lng, event.lat),
    }
  : undefined;

/** terra-draw store id (UUID by default); Territory slug lives in properties.id. */
type DrawFeatureId = string | number;

type TerritoryListItem = {
  drawId: DrawFeatureId;
  id: string;
  name: string;
  status: TerritoryEditStatus;
};

function territoryLabel(territory: TerritoryListItem): string {
  return territory.name || territory.id || String(territory.drawId);
}

function boundsForPolygonRings(
  rings: Position[][],
): LngLatBounds | null {
  const bounds = new LngLatBounds();
  let hasPoint = false;
  for (const ring of rings) {
    for (const position of ring) {
      const lng = position[0];
      const lat = position[1];
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        continue;
      }
      bounds.extend([lng, lat]);
      hasPoint = true;
    }
  }
  return hasPoint ? bounds : null;
}

@Component({
  selector: 'app-territory-author',
  imports: [
    MapComponent,
    ImageSourceComponent,
    LayerComponent,
    ControlComponent,
    NavigationControlDirective,
  ],
  templateUrl: './territory-author.html',
  styleUrl: './territory-author.scss',
})
export class TerritoryAuthor {
  private readonly destroyRef = inject(DestroyRef);
  private map: MapLibreMap | null = null;
  private draw: TerraDraw | null = null;
  private selectedDrawId: DrawFeatureId | null = null;
  /** Avoid re-entrant change handling while force-snapping geometries. */
  private snappingGeometries = false;
  /** Skip persist during initial addFeatures so origin load doesn't shadow later file updates. */
  private draftReady = false;
  /** Cached origin FeatureCollection for “missing from local” highlight. */
  private originCollection: TerritoryCollection | null = null;
  private originById = new Map<
    string,
    Feature<Polygon, TerritoryProperties>
  >();

  protected readonly basemapUrl = '/basemap.webp';
  protected readonly imageCoordinates = BOARD_IMAGE_COORDINATES;
  protected readonly fitBounds = BOARD_BOUNDS;
  protected readonly maxBounds = BOARD_MAX_BOUNDS;
  protected readonly fitBoundsOptions: FitBoundsOptions = {
    padding: 24,
    animate: false,
  };
  protected readonly basemapPaint: RasterLayerSpecification['paint'] = {
    'raster-resampling': 'nearest',
  };
  protected readonly mapStyle: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#31A2F2' },
      },
    ],
  };

  protected readonly mode = signal<'polygon' | 'select'>('select');
  protected readonly selectedName = signal('');
  protected readonly selectedIdPreview = signal('');
  protected readonly selectedDrawIdSignal = signal<DrawFeatureId | null>(null);
  protected readonly hasSelection = signal(false);
  protected readonly originalTerritories = signal<TerritoryListItem[]>([]);
  protected readonly changedTerritories = signal<TerritoryListItem[]>([]);
  protected readonly originalListCollapsed = signal(false);
  protected readonly changedListCollapsed = signal(false);
  protected readonly originHasExtras = signal(false);
  protected readonly status = signal('Loading territories…');

  protected async onMapLoad(map: MapLibreMap): Promise<void> {
    this.map = map;
    map.touchZoomRotate.disableRotation();

    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({
        map,
        // Must match BOARD_COORDINATE_DECIMALS — Mercator snap exceeds the default
        // only if we forget to quantize; keep adapter + snap in lockstep.
        coordinatePrecision: BOARD_COORDINATE_DECIMALS,
      }),
      modes: [
        new TerraDrawPolygonMode({
          // Light vertex edits without leaving draw mode (finish still switches to select).
          editable: true,
          ...(boardPixelSnapping ? { snapping: boardPixelSnapping } : {}),
          // Yellow reads clearly on the board’s blue ocean background.
          styles: {
            fillColor: '#F0C14B',
            fillOpacity: 0.35,
            outlineColor: '#5A3D0B',
            outlineWidth: 2,
          },
        }),
        new TerraDrawSelectMode({
          // Selection is sidebar-only; map clicks must not pick polygons.
          allowManualSelection: false,
          // Dense Territory outlines need a forgiving hit target for vertex grabs.
          pointerDistance: 28,
          styles: {
            // Vertices: light filled handles.
            selectionPointColor: '#F4F7FA',
            selectionPointOutlineColor: '#12202B',
            selectionPointWidth: 10,
            selectionPointOutlineWidth: 2,
            // Midpoints: smaller + vivid so they read as “insert here”, not vertices.
            // (terra-draw only exposes circle markers; shape change isn’t available.)
            midPointColor: '#1EE0A0',
            midPointOutlineColor: '#063D2C',
            midPointWidth: 7,
            midPointOutlineWidth: 2,
            midPointOpacity: 1,
            selectedPolygonColor: '#F0C14B',
            selectedPolygonFillOpacity: 0.4,
            selectedPolygonOutlineColor: '#5A3D0B',
            selectedPolygonOutlineWidth: 2,
          },
          flags: {
            polygon: {
              feature: {
                // Prefer vertex editing over moving the whole polygon.
                draggable: false,
                coordinates: {
                  midpoints: {
                    draggable: true,
                  },
                  draggable: true,
                  deletable: true,
                  ...(boardPixelSnapping
                    ? { snappable: boardPixelSnapping }
                    : {}),
                },
              },
            },
          },
        }),
      ],
    });

    draw.start();
    this.draw = draw;
    this.setMode('select');

    draw.on('finish', (id, context) => {
      this.forceSnapFeature(id);
      // Collinear simplify must NOT run on insertMidpoint — the new vertex lies on
      // the edge (collinear with neighbors) until the user drags it off the line.
      if (context.action === 'draw') {
        this.simplifyFeature(id);
      }
      this.refreshTerritoryList();
      this.persistLocalDraft();
      // setMode('select') restarts select mode and clears the current selection.
      // Only do that after a new draw — vertex edits must stay selected.
      if (context.action === 'draw') {
        this.setMode('select');
        this.draw?.selectFeature(id);
        this.selectFeature(id);
        this.status.set('Set a name for the new Territory, then Apply.');
        return;
      }
      this.selectFeature(id);
    });

    draw.on('change', () => {
      this.refreshTerritoryList();
      this.persistLocalDraft();
    });

    draw.on('select', (id) => {
      this.selectFeature(id);
    });

    draw.on('deselect', () => {
      this.clearSelection();
    });

    this.destroyRef.onDestroy(() => {
      draw.stop();
      this.draw = null;
      this.map = null;
    });

    await this.loadTerritories(draw);
    this.draftReady = true;
  }

  protected setMode(mode: 'polygon' | 'select'): void {
    this.mode.set(mode);
    this.draw?.setMode(mode);
  }

  protected selectFromList(drawId: DrawFeatureId): void {
    if (!this.draw) {
      return;
    }
    this.setMode('select');
    this.draw.selectFeature(drawId);
    this.selectFeature(drawId);
    this.fitMapToFeature(drawId);
  }

  private fitMapToFeature(drawId: DrawFeatureId): void {
    if (!this.map || !this.draw) {
      return;
    }
    const feature = this.draw.getSnapshotFeature(drawId);
    if (!feature || feature.geometry.type !== 'Polygon') {
      return;
    }

    const bounds = boundsForPolygonRings(feature.geometry.coordinates);
    if (!bounds) {
      return;
    }

    this.map.fitBounds(bounds, {
      padding: 64,
      // Board sits near z≈8; allow closer zoom so small Territories fill the view.
      maxZoom: 12,
      duration: 400,
    });
  }

  protected toggleOriginalList(): void {
    this.originalListCollapsed.update((collapsed) => !collapsed);
  }

  protected toggleChangedList(): void {
    this.changedListCollapsed.update((collapsed) => !collapsed);
  }

  protected deleteTerritory(drawId: DrawFeatureId): void {
    if (!this.draw) {
      return;
    }

    const feature = this.draw.getSnapshotFeature(drawId);
    const label =
      String(feature?.properties?.['name'] ?? '').trim() ||
      String(feature?.properties?.['id'] ?? '').trim() ||
      'Territory';

    if (this.selectedDrawId === drawId) {
      this.draw.deselectFeature(drawId);
      this.clearSelection();
    }

    this.draw.removeFeatures([drawId]);
    this.refreshTerritoryList();
    this.persistLocalDraft();
    this.status.set(`Deleted ${label}.`);
  }

  protected onNameInput(value: string): void {
    this.selectedName.set(value);
    this.selectedIdPreview.set(this.previewIdForName(value));
  }

  protected applyProperties(): void {
    if (!this.draw || this.selectedDrawId === null) {
      return;
    }

    const name = this.selectedName().trim();
    if (!name) {
      this.status.set('Territory name is required.');
      return;
    }

    const base = slugifyTerritoryName(name);
    if (!base) {
      this.status.set('Name must include letters or numbers to build an id.');
      return;
    }

    const id = uniqueTerritoryId(base, this.takenIdsExcluding(this.selectedDrawId));
    this.draw.updateFeatureProperties(this.selectedDrawId, { id, name });
    this.selectedIdPreview.set(id);
    this.refreshTerritoryList();
    this.persistLocalDraft();
    this.status.set(`Updated ${name} (${id}). Download when ready to commit.`);
  }

  protected download(): void {
    if (!this.draw) {
      return;
    }

    const { collection, missingIds } = toTerritoryCollection(this.draw.getSnapshot());
    if (missingIds > 0) {
      this.status.set(
        `${missingIds} polygon(s) lack a name/id — Apply a name before download.`,
      );
      return;
    }

    downloadTerritoryCollection(collection);
    this.status.set(
      `Downloaded ${collection.features.length} Territories. Replace public/territories.geojson and commit.`,
    );
  }

  protected async reloadFromOrigin(): Promise<void> {
    if (!this.draw) {
      return;
    }

    this.draftReady = false;
    clearLocalTerritoryCollection();
    this.clearSelection();
    this.draw.clear();

    try {
      const collection = await fetchTerritoryCollection();
      this.setOriginCollection(collection);
      this.applyLoadedCollection(this.draw, collection, 'territories.geojson');
      this.updateOriginExtrasHighlight();
      this.status.set(
        `Dropped local changes. Reloaded ${collection.features.length} Territories from territories.geojson.`,
      );
    } catch {
      this.refreshTerritoryList();
      this.updateOriginExtrasHighlight();
      this.setMode('polygon');
      this.status.set('Could not reload territories.geojson — draft cleared.');
    } finally {
      this.draftReady = true;
    }
  }

  private async loadTerritories(draw: TerraDraw): Promise<void> {
    const local = loadLocalTerritoryCollection();
    if (local !== null) {
      this.applyLoadedCollection(draw, local, 'local draft');
      await this.refreshOriginCollection();
      return;
    }

    try {
      const collection = await fetchTerritoryCollection();
      this.setOriginCollection(collection);
      this.applyLoadedCollection(draw, collection, 'territories.geojson');
      this.updateOriginExtrasHighlight();
    } catch {
      this.refreshTerritoryList();
      this.setMode('polygon');
      this.status.set('Could not load territories.geojson — starting empty.');
    }
  }

  private async refreshOriginCollection(): Promise<void> {
    try {
      this.setOriginCollection(await fetchTerritoryCollection());
    } catch {
      this.setOriginCollection(null);
    }
    this.refreshTerritoryList();
    this.updateOriginExtrasHighlight();
  }

  private setOriginCollection(collection: TerritoryCollection | null): void {
    this.originCollection = collection;
    this.originById = new Map(
      (collection?.features ?? []).map((feature) => [
        feature.properties.id,
        feature,
      ]),
    );
  }

  private updateOriginExtrasHighlight(): void {
    if (!this.originCollection || !this.draw) {
      this.originHasExtras.set(false);
      return;
    }

    const local = snapshotToDraftCollection(this.draw.getSnapshot());
    this.originHasExtras.set(
      originTerritoryIdsNotInLocal(this.originCollection, local).length > 0,
    );
  }

  private applyLoadedCollection(
    draw: TerraDraw,
    collection: TerritoryCollection,
    sourceLabel: string,
  ): void {
    const features = toTerraDrawFeatures(collection);
    if (features.length === 0) {
      this.refreshTerritoryList();
      this.setMode('polygon');
      this.status.set(
        `No Territories in ${sourceLabel} — draw a polygon, set a name, then Download.`,
      );
      return;
    }

    const results = draw.addFeatures(features);
    const rejected = results.filter((result) => !result.valid);
    this.refreshTerritoryList();
    if (rejected.length > 0) {
      const reasons = rejected
        .map((result) => result.reason ?? 'unknown')
        .join('; ');
      this.setMode('select');
      this.status.set(
        `Loaded ${features.length - rejected.length}/${features.length} from ${sourceLabel}. Rejected: ${reasons}`,
      );
      return;
    }

    this.setMode('select');
    this.status.set(
      `Loaded ${features.length} Territories from ${sourceLabel}. Pick one in the list to edit; midpoints add points; Delete removes a selected vertex.`,
    );
  }

  private persistLocalDraft(): void {
    if (!this.draw || this.snappingGeometries || !this.draftReady) {
      return;
    }
    saveLocalTerritoryCollection(
      snapshotToDraftCollection(this.draw.getSnapshot()),
    );
    this.updateOriginExtrasHighlight();
  }

  private forceSnapFeature(id: DrawFeatureId): void {
    if (!BOARD_PIXEL_SNAP_ENABLED || !this.draw) {
      return;
    }
    const feature = this.draw.getSnapshotFeature(id);
    if (!feature || feature.geometry.type !== 'Polygon') {
      return;
    }

    const snapped = snapPolygonToBoardPixels(feature.geometry);
    const before = JSON.stringify(feature.geometry.coordinates);
    const after = JSON.stringify(snapped.coordinates);
    if (before === after) {
      return;
    }

    this.snappingGeometries = true;
    try {
      this.draw.updateFeatureGeometry(id, snapped);
    } finally {
      this.snappingGeometries = false;
    }
  }

  /** Drop collinear mid-vertices after finalize; no-op when shape would change. */
  private simplifyFeature(id: DrawFeatureId): void {
    if (!this.draw) {
      return;
    }
    const feature = this.draw.getSnapshotFeature(id);
    if (!feature || feature.geometry.type !== 'Polygon') {
      return;
    }

    const simplified = simplifyPolygonCollinear(feature.geometry);
    const before = JSON.stringify(feature.geometry.coordinates);
    const after = JSON.stringify(simplified.coordinates);
    if (before === after) {
      return;
    }

    this.snappingGeometries = true;
    try {
      this.draw.updateFeatureGeometry(id, simplified);
    } finally {
      this.snappingGeometries = false;
    }
  }

  private refreshTerritoryList(): void {
    if (!this.draw) {
      this.originalTerritories.set([]);
      this.changedTerritories.set([]);
      return;
    }

    const items: TerritoryListItem[] = [];
    for (const feature of this.draw.getSnapshot()) {
      if (feature.geometry.type !== 'Polygon') {
        continue;
      }
      const id = String(feature.properties?.['id'] ?? '');
      items.push({
        drawId: feature.id as DrawFeatureId,
        id,
        name: String(feature.properties?.['name'] ?? ''),
        status: classifyTerritoryEditStatus(
          id,
          feature.geometry,
          this.originById,
        ),
      });
    }

    const originals = items
      .filter((territory) => territory.status === 'original')
      .sort((a, b) => territoryLabel(a).localeCompare(territoryLabel(b)));
    const changed = items
      .filter((territory) => territory.status !== 'original')
      .sort((a, b) => {
        // New first, then modified; alphabetical within each group.
        if (a.status !== b.status) {
          return a.status === 'new' ? -1 : 1;
        }
        return territoryLabel(a).localeCompare(territoryLabel(b));
      });

    this.originalTerritories.set(originals);
    this.changedTerritories.set(changed);
  }

  private selectFeature(id: DrawFeatureId): void {
    if (!this.draw) {
      return;
    }

    const feature = this.draw.getSnapshotFeature(id);
    const name = String(feature?.properties?.['name'] ?? '');
    this.selectedDrawId = id;
    this.selectedDrawIdSignal.set(id);
    this.hasSelection.set(true);
    this.selectedName.set(name);
    this.selectedIdPreview.set(
      String(feature?.properties?.['id'] ?? '') || this.previewIdForName(name),
    );
  }

  private clearSelection(): void {
    this.selectedDrawId = null;
    this.selectedDrawIdSignal.set(null);
    this.hasSelection.set(false);
    this.selectedName.set('');
    this.selectedIdPreview.set('');
  }

  private previewIdForName(name: string): string {
    const base = slugifyTerritoryName(name);
    if (!base || this.selectedDrawId === null) {
      return base;
    }
    return uniqueTerritoryId(base, this.takenIdsExcluding(this.selectedDrawId));
  }

  private takenIdsExcluding(drawId: DrawFeatureId): string[] {
    return [...this.changedTerritories(), ...this.originalTerritories()]
      .filter((territory) => territory.drawId !== drawId && territory.id)
      .map((territory) => territory.id);
  }
}
