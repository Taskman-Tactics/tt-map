/**
 * Board space for basemap.webp (2048×1503), ADR-0001.
 *
 * MapLibre LngLat requires latitude in [-90, 90], so pixel positions are
 * divided by BOARD_COORD_SCALE. Territory GeoJSON from the API must use the
 * same scaled space (pixel / 100).
 */
export const BOARD_WIDTH_PX = 2048;
export const BOARD_HEIGHT_PX = 1503;
export const BOARD_COORD_SCALE = 100;

export const BOARD_WIDTH = BOARD_WIDTH_PX / BOARD_COORD_SCALE;
export const BOARD_HEIGHT = BOARD_HEIGHT_PX / BOARD_COORD_SCALE;

/** Southwest / northeast corners for fitBounds and maxBounds. */
export const BOARD_BOUNDS: [[number, number], [number, number]] = [
  [0, 0],
  [BOARD_WIDTH, BOARD_HEIGHT],
];

const BOUND_PADDING_RATIO = 0.05;

export const BOARD_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-BOARD_WIDTH * BOUND_PADDING_RATIO, -BOARD_HEIGHT * BOUND_PADDING_RATIO],
  [BOARD_WIDTH * (1 + BOUND_PADDING_RATIO), BOARD_HEIGHT * (1 + BOUND_PADDING_RATIO)],
];

/** Image source corners: top-left, top-right, bottom-right, bottom-left. */
export const BOARD_IMAGE_COORDINATES: [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] = [
  [0, BOARD_HEIGHT],
  [BOARD_WIDTH, BOARD_HEIGHT],
  [BOARD_WIDTH, 0],
  [0, 0],
];
