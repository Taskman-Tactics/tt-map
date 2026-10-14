import { describe, expect, it } from 'vitest';
import {
  BOARD_HEIGHT_PX,
  BOARD_IMAGE_COORDINATES,
  BOARD_WIDTH_PX,
  boardPixelToLngLat,
} from './board-coordinates';
import {
  BOARD_COORDINATE_DECIMALS,
  boardImageUvToLngLat,
  boardPixelSnapErrorPx,
  lngLatToBoardImageUv,
  lngLatToBoardPixelIndices,
  snapLngLatToBoardPixel,
} from './board-pixel-snap';
import { PIXEL_SNAP_REFERENCE_VERTICES } from './fixtures/pixel-snap-reference-vertices';

/** Mirrors terra-draw’s decimal-place counter used for coordinatePrecision. */
function terraDrawDecimalPlaces(value: number): number {
  let factor = 1;
  let places = 0;
  while (Math.round(value * factor) / factor !== value) {
    factor *= 10;
    places += 1;
  }
  return places;
}

describe('board-pixel-snap', () => {
  it('maps image corners to UV 0/1 on the Web Mercator plane', () => {
    const [tlLng, tlLat] = BOARD_IMAGE_COORDINATES[0]!;
    const [brLng, brLat] = BOARD_IMAGE_COORDINATES[2]!;

    const topLeft = lngLatToBoardImageUv(tlLng, tlLat);
    expect(topLeft.u).toBeCloseTo(0, 12);
    expect(topLeft.v).toBeCloseTo(0, 12);

    const bottomRight = lngLatToBoardImageUv(brLng, brLat);
    expect(bottomRight.u).toBeCloseTo(1, 12);
    expect(bottomRight.v).toBeCloseTo(1, 12);
  });

  it('uses equal Mercator steps per pixel (square texels)', () => {
    const [aLng, aLat] = boardPixelToLngLat(100, 100);
    const [bLng, bLat] = boardPixelToLngLat(101, 100);
    const [cLng, cLat] = boardPixelToLngLat(100, 101);

    const { u: u0, v: v0 } = lngLatToBoardImageUv(aLng, aLat);
    const { u: u1 } = lngLatToBoardImageUv(bLng, bLat);
    const { v: v1 } = lngLatToBoardImageUv(cLng, cLat);

    expect(u1 - u0).toBeCloseTo(1 / BOARD_WIDTH_PX, 12);
    expect(v1 - v0).toBeCloseTo(1 / BOARD_HEIGHT_PX, 12);
  });

  it('is idempotent on already-snapped points', () => {
    const [lng, lat] = boardPixelToLngLat(145.4, 682.4);
    const once = snapLngLatToBoardPixel(lng, lat);
    const twice = snapLngLatToBoardPixel(once[0], once[1]);
    expect(twice[0]).toBe(once[0]);
    expect(twice[1]).toBe(once[1]);
  });

  it('stays within terra-draw default coordinatePrecision (9 decimals)', () => {
    const [lng, lat] = boardPixelToLngLat(10.0123456789, 7.4987654321);
    const [slng, slat] = snapLngLatToBoardPixel(lng, lat);
    expect(terraDrawDecimalPlaces(slng)).toBeLessThanOrEqual(
      BOARD_COORDINATE_DECIMALS,
    );
    expect(terraDrawDecimalPlaces(slat)).toBeLessThanOrEqual(
      BOARD_COORDINATE_DECIMALS,
    );
  });

  it('keeps hand-placed reference Territories within half a basemap texel', () => {
    expect(PIXEL_SNAP_REFERENCE_VERTICES.length).toBeGreaterThan(40);

    let maxErrPx = 0;
    let sumErrPx = 0;
    let maxBoardErr = 0;

    for (const vertex of PIXEL_SNAP_REFERENCE_VERTICES) {
      const { errPx } = boardPixelSnapErrorPx(vertex.lng, vertex.lat);
      const [slng, slat] = snapLngLatToBoardPixel(vertex.lng, vertex.lat);
      const boardErr = Math.hypot(slng - vertex.lng, slat - vertex.lat);

      maxErrPx = Math.max(maxErrPx, errPx);
      sumErrPx += errPx;
      maxBoardErr = Math.max(maxBoardErr, boardErr);
    }

    expect(maxErrPx).toBeLessThan(0.5);
    expect(sumErrPx / PIXEL_SNAP_REFERENCE_VERTICES.length).toBeLessThan(0.15);
    expect(maxBoardErr).toBeGreaterThanOrEqual(0);
  });

  it('snaps jitter around a reference vertex back to the same pixel indices', () => {
    const sample = PIXEL_SNAP_REFERENCE_VERTICES[0]!;
    const target = lngLatToBoardPixelIndices(sample.lng, sample.lat);

    for (const [du, dv] of [
      [0.2, 0.2],
      [-0.2, 0.1],
      [0.3, -0.25],
      [-0.4, -0.4],
    ] as const) {
      const [offsetLng, offsetLat] = boardImageUvToLngLat(
        (target.px + du) / BOARD_WIDTH_PX,
        (target.py + dv) / BOARD_HEIGHT_PX,
      );
      expect(lngLatToBoardPixelIndices(offsetLng, offsetLat)).toEqual(target);
    }
  });
});
