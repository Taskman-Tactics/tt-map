import { Component } from '@angular/core';
import {
  ControlComponent,
  GeoJSONSourceComponent,
  ImageSourceComponent,
  LayerComponent,
  MapComponent,
  NavigationControlDirective,
} from '@maplibre/ngx-maplibre-gl';
import type {
  FitBoundsOptions,
  FillLayerSpecification,
  LineLayerSpecification,
  Map as MapLibreMap,
  RasterLayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';
import { TERRITORIES_GEOJSON_URL } from '../territory/territory-geojson';
import {
  BOARD_BOUNDS,
  BOARD_IMAGE_COORDINATES,
  BOARD_MAX_BOUNDS,
} from './board-coordinates';

@Component({
  selector: 'app-board-map',
  imports: [
    MapComponent,
    ImageSourceComponent,
    GeoJSONSourceComponent,
    LayerComponent,
    ControlComponent,
    NavigationControlDirective,
  ],
  templateUrl: './board-map.html',
  styleUrl: './board-map.scss',
})
export class BoardMap {
  protected readonly basemapUrl = '/basemap.webp';
  protected readonly territoriesUrl = TERRITORIES_GEOJSON_URL;
  protected readonly imageCoordinates = BOARD_IMAGE_COORDINATES;
  protected readonly fitBounds = BOARD_BOUNDS;
  protected readonly maxBounds = BOARD_MAX_BOUNDS;
  protected readonly fitBoundsOptions: FitBoundsOptions = {
    padding: 24,
    animate: false,
  };
  /** Nearest-neighbor keeps the board crisp when zooming past native resolution. */
  protected readonly basemapPaint: RasterLayerSpecification['paint'] = {
    'raster-resampling': 'nearest',
  };
  protected readonly territoryFillPaint: FillLayerSpecification['paint'] = {
    'fill-color': '#f0c14b',
    'fill-opacity': 0.35,
  };
  protected readonly territoryLinePaint: LineLayerSpecification['paint'] = {
    'line-color': '#5a3d0b',
    'line-width': 1.5,
  };

  protected readonly mapStyle: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#31A2F2',
        },
      },
    ],
  };

  protected onMapLoad(map: MapLibreMap): void {
    map.touchZoomRotate.disableRotation();
  }
}
