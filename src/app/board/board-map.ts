import { Component } from '@angular/core';
import {
  ControlComponent,
  ImageSourceComponent,
  LayerComponent,
  MapComponent,
  NavigationControlDirective,
} from '@maplibre/ngx-maplibre-gl';
import type {
  FitBoundsOptions,
  Map as MapLibreMap,
  RasterLayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';
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
    LayerComponent,
    ControlComponent,
    NavigationControlDirective,
  ],
  templateUrl: './board-map.html',
  styleUrl: './board-map.scss',
})
export class BoardMap {
  protected readonly basemapUrl = '/basemap.webp';
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
