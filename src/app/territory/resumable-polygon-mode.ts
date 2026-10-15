import type { Position } from 'geojson';
import {
  TerraDrawPolygonMode,
  type TerraDrawMouseEvent,
} from 'terra-draw';

/**
 * Polygon mode that can rebuild an in-progress draw from unique ring vertices.
 * Used to reopen a just-closed Territory after Ctrl+Z (terra-draw clears mode
 * history on close, so native undo cannot resume drawing).
 */
export class ResumablePolygonMode extends TerraDrawPolygonMode {
  /**
   * Replay left-clicks for each vertex so closing points and mode undo history
   * match a normal draw. Caller must already be in this mode (`started`).
   */
  resumeDrawing(vertices: Position[]): void {
    if (vertices.length < 3) {
      return;
    }

    for (const position of vertices) {
      const lng = position[0];
      const lat = position[1];
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        continue;
      }
      const event: TerraDrawMouseEvent = {
        lng,
        lat,
        containerX: 0,
        containerY: 0,
        button: 'left',
        heldKeys: [],
        isContextMenu: false,
      };
      this.onClick(event);
    }
  }
}
