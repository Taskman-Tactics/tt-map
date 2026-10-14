import type { Polygon, Position } from 'geojson';
import {
  boardPixelIndicesToLngLat,
  lngLatToBoardPixelIndices,
} from './board-pixel-snap';

type Pixel = { px: number; py: number };

function samePixel(a: Pixel, b: Pixel): boolean {
  return a.px === b.px && a.py === b.py;
}

/** Exact integer collinearity — removing the middle point cannot change the shape. */
function isCollinear(a: Pixel, b: Pixel, c: Pixel): boolean {
  return (b.px - a.px) * (c.py - a.py) - (b.py - a.py) * (c.px - a.px) === 0;
}

function openRingPixels(ring: Position[]): Pixel[] {
  if (ring.length === 0) {
    return [];
  }
  const pixels = ring.map(([lng, lat]) => lngLatToBoardPixelIndices(lng, lat));
  const first = pixels[0]!;
  const last = pixels[pixels.length - 1]!;
  if (samePixel(first, last)) {
    return pixels.slice(0, -1);
  }
  return pixels;
}

/**
 * Drop consecutive duplicates and intermediate vertices that lie exactly on the
 * line between their neighbors (pixel-grid collinear). Aborts if the ring would
 * fall below 3 vertices — shape-preserving only.
 */
export function simplifyCollinearBoardRing(ring: Position[]): Position[] {
  let pixels = openRingPixels(ring);
  if (pixels.length <= 3) {
    return ring;
  }

  // Collapse consecutive duplicates first.
  pixels = pixels.filter((pixel, index) => {
    if (index === 0) {
      return true;
    }
    return !samePixel(pixel, pixels[index - 1]!);
  });
  if (
    pixels.length > 1 &&
    samePixel(pixels[0]!, pixels[pixels.length - 1]!)
  ) {
    pixels = pixels.slice(0, -1);
  }

  if (pixels.length <= 3) {
    return ring;
  }

  let changed = true;
  while (changed && pixels.length > 3) {
    changed = false;
    const next: Pixel[] = [];
    for (let i = 0; i < pixels.length; i++) {
      const prev = pixels[(i - 1 + pixels.length) % pixels.length]!;
      const curr = pixels[i]!;
      const nxt = pixels[(i + 1) % pixels.length]!;
      if (isCollinear(prev, curr, nxt)) {
        changed = true;
        continue;
      }
      next.push(curr);
    }
    if (next.length < 3) {
      // Would destroy the polygon — keep the last safe ring.
      break;
    }
    pixels = next;
  }

  if (pixels.length < 3) {
    return ring;
  }

  const simplified = pixels.map((pixel) =>
    boardPixelIndicesToLngLat(pixel.px, pixel.py),
  );
  const first = simplified[0]!;
  return [...simplified, first];
}

/** Simplify each ring; identity when no collinear runs can be removed safely. */
export function simplifyPolygonCollinear(geometry: Polygon): Polygon {
  return {
    type: 'Polygon',
    coordinates: geometry.coordinates.map((ring) =>
      simplifyCollinearBoardRing(ring),
    ),
  };
}
