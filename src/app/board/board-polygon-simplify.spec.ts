import { describe, expect, it } from 'vitest';
import { boardPixelIndicesToLngLat } from './board-pixel-snap';
import {
  simplifyCollinearBoardRing,
  simplifyPolygonCollinear,
} from './board-polygon-simplify';

function ringFromPixels(points: Array<[number, number]>): number[][] {
  const ring = points.map(([px, py]) => boardPixelIndicesToLngLat(px, py));
  return [...ring, ring[0]!];
}

describe('board-polygon-simplify', () => {
  it('collapses sequential collinear points to the two endpoints', () => {
    // Horizontal run: (0,0)-(1,0)-(2,0)-(3,0) then up and back.
    const input = ringFromPixels([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [3, 2],
      [0, 2],
    ]);

    const simplified = simplifyCollinearBoardRing(input);
    const expected = ringFromPixels([
      [0, 0],
      [3, 0],
      [3, 2],
      [0, 2],
    ]);

    expect(simplified).toEqual(expected);
  });

  it('collapses diagonal collinear runs without changing corners', () => {
    const input = ringFromPixels([
      [0, 0],
      [1, 1],
      [2, 2],
      [2, 0],
    ]);

    const simplified = simplifyCollinearBoardRing(input);
    expect(simplified).toEqual(
      ringFromPixels([
        [0, 0],
        [2, 2],
        [2, 0],
      ]),
    );
  });

  it('leaves a triangle unchanged', () => {
    const input = ringFromPixels([
      [0, 0],
      [3, 0],
      [0, 3],
    ]);
    expect(simplifyCollinearBoardRing(input)).toEqual(input);
  });

  it('does not remove a bend that would change the shape', () => {
    const input = ringFromPixels([
      [0, 0],
      [2, 0],
      [2, 1],
      [3, 1],
      [3, 3],
      [0, 3],
    ]);
    expect(simplifyCollinearBoardRing(input)).toEqual(input);
  });

  it('simplifies polygon rings', () => {
    const geometry = {
      type: 'Polygon' as const,
      coordinates: [
        ringFromPixels([
          [0, 0],
          [1, 0],
          [2, 0],
          [2, 2],
          [0, 2],
        ]),
      ],
    };

    expect(simplifyPolygonCollinear(geometry).coordinates[0]).toEqual(
      ringFromPixels([
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ]),
    );
  });
});
