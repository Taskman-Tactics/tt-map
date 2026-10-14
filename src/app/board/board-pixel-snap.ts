import {
  BOARD_HEIGHT_PX,
  BOARD_MERCATOR_ORIGIN,
  BOARD_MERCATOR_UNITS_PER_PIXEL,
  BOARD_WIDTH_PX,
  boardPixelToLngLat,
  lngLatToBoardMercator,
} from './board-coordinates';

type LngLatTuple = [number, number];

/** Author draw/edit + export snap onto basemap texels. */
export const BOARD_PIXEL_SNAP_ENABLED = true;

/**
 * terra-draw’s default coordinatePrecision is 9 and rejects “excessive”
 * decimals. Quantize so Author addFeatures accepts snapped geometry.
 */
export const BOARD_COORDINATE_DECIMALS = 9;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function quantizeCoord(value: number): number {
  return Number(value.toFixed(BOARD_COORDINATE_DECIMALS));
}

/** Fraction (u,v) across the basemap on the Web Mercator plane. */
export function lngLatToBoardImageUv(lng: number, lat: number): {
  u: number;
  v: number;
} {
  const point = lngLatToBoardMercator(lng, lat);
  return {
    u:
      (point.x - BOARD_MERCATOR_ORIGIN.x) /
      (BOARD_WIDTH_PX * BOARD_MERCATOR_UNITS_PER_PIXEL),
    v:
      (point.y - BOARD_MERCATOR_ORIGIN.y) /
      (BOARD_HEIGHT_PX * BOARD_MERCATOR_UNITS_PER_PIXEL),
  };
}

export function boardImageUvToLngLat(u: number, v: number): LngLatTuple {
  return boardPixelToLngLat(u * BOARD_WIDTH_PX, v * BOARD_HEIGHT_PX);
}

export function lngLatToBoardPixelIndices(
  lng: number,
  lat: number,
): { px: number; py: number } {
  const { u, v } = lngLatToBoardImageUv(lng, lat);
  return {
    px: clamp(Math.round(u * BOARD_WIDTH_PX), 0, BOARD_WIDTH_PX),
    py: clamp(Math.round(v * BOARD_HEIGHT_PX), 0, BOARD_HEIGHT_PX),
  };
}

export function boardPixelIndicesToLngLat(px: number, py: number): LngLatTuple {
  const [lng, lat] = boardPixelToLngLat(px, py);
  return [quantizeCoord(lng), quantizeCoord(lat)];
}

/** Nearest basemap texel corner (Web Mercator–linear pixel grid). */
export function snapLngLatToBoardPixel(lng: number, lat: number): LngLatTuple {
  const { px, py } = lngLatToBoardPixelIndices(lng, lat);
  return boardPixelIndicesToLngLat(px, py);
}

/** Distance in basemap texels between a LngLat and its snapped grid point. */
export function boardPixelSnapErrorPx(
  lng: number,
  lat: number,
): { errPx: number; px: number; py: number } {
  const { u, v } = lngLatToBoardImageUv(lng, lat);
  const { px, py } = lngLatToBoardPixelIndices(lng, lat);
  return {
    px,
    py,
    errPx: Math.hypot(u * BOARD_WIDTH_PX - px, v * BOARD_HEIGHT_PX - py),
  };
}
