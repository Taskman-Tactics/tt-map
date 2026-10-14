import { MercatorCoordinate } from 'maplibre-gl';

/**
 * Board space for basemap.webp (2048×1503), ADR-0001.
 *
 * Pixels are laid out linearly on the Web Mercator plane (MapLibre’s
 * MercatorCoordinate), then converted to WGS84 LngLat for GeoJSON / the API.
 * That keeps basemap texels square in the projection MapLibre actually paints,
 * unlike the older “LngLat = pixel/100” box which warped rows under Mercator.
 */
export const BOARD_WIDTH_PX = 2048;
export const BOARD_HEIGHT_PX = 1503;

/**
 * Mercator-world units per basemap pixel (equal X/Y → square texels on the
 * Mercator plane). Board width is 1/256 of the world (~one z=8 tile).
 */
export const BOARD_MERCATOR_UNITS_PER_PIXEL =
  1 / 256 / BOARD_WIDTH_PX;

const boardMercatorWidth = BOARD_WIDTH_PX * BOARD_MERCATOR_UNITS_PER_PIXEL;
const boardMercatorHeight = BOARD_HEIGHT_PX * BOARD_MERCATOR_UNITS_PER_PIXEL;

/** Top-left of the basemap in MercatorCoordinate space (y increases south). */
export const BOARD_MERCATOR_ORIGIN = {
  x: 0.5 - boardMercatorWidth / 2,
  y: 0.5 - boardMercatorHeight / 2,
} as const;

export function boardPixelToMercator(
  px: number,
  py: number,
): MercatorCoordinate {
  return new MercatorCoordinate(
    BOARD_MERCATOR_ORIGIN.x + px * BOARD_MERCATOR_UNITS_PER_PIXEL,
    BOARD_MERCATOR_ORIGIN.y + py * BOARD_MERCATOR_UNITS_PER_PIXEL,
  );
}

export function boardPixelToLngLat(px: number, py: number): [number, number] {
  const { lng, lat } = boardPixelToMercator(px, py).toLngLat();
  return [lng, lat];
}

export function lngLatToBoardMercator(
  lng: number,
  lat: number,
): MercatorCoordinate {
  return MercatorCoordinate.fromLngLat({ lng, lat });
}

/** Image source corners: top-left, top-right, bottom-right, bottom-left. */
export const BOARD_IMAGE_COORDINATES: [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] = [
  boardPixelToLngLat(0, 0),
  boardPixelToLngLat(BOARD_WIDTH_PX, 0),
  boardPixelToLngLat(BOARD_WIDTH_PX, BOARD_HEIGHT_PX),
  boardPixelToLngLat(0, BOARD_HEIGHT_PX),
];

const [imageWest, imageSouth] = BOARD_IMAGE_COORDINATES[3]!;
const [imageEast, imageNorth] = BOARD_IMAGE_COORDINATES[1]!;

/** Southwest / northeast corners for fitBounds. */
export const BOARD_BOUNDS: [[number, number], [number, number]] = [
  [imageWest, imageSouth],
  [imageEast, imageNorth],
];

const BOUND_PADDING_RATIO = 0.05;
const boundPadX = (imageEast - imageWest) * BOUND_PADDING_RATIO;
const boundPadY = (imageNorth - imageSouth) * BOUND_PADDING_RATIO;

export const BOARD_MAX_BOUNDS: [[number, number], [number, number]] = [
  [imageWest - boundPadX, imageSouth - boundPadY],
  [imageEast + boundPadX, imageNorth + boundPadY],
];
