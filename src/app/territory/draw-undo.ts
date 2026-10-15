import type { Position } from 'geojson';

/** Just-finished draw that Ctrl+Z can reopen into polygon mode. */
export type PendingReopen = {
  featureId: string | number;
  /** Unique outer-ring vertices (closing duplicate stripped). */
  vertices: Position[];
};

/** Strip a closed ring's duplicate last point when first === last. */
export function openRingVertices(ring: Position[]): Position[] {
  if (ring.length === 0) {
    return [];
  }
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  const closed =
    ring.length >= 2 && first[0] === last[0] && first[1] === last[1];
  const open = closed ? ring.slice(0, -1) : ring;
  return open.map((position) => [position[0]!, position[1]!]);
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  return target.isContentEditable;
}

export function isUndoKeyEvent(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === 'z'
  );
}

export type AuthorUndoAction = 'mode-undo' | 'reopen';

/** Decide whether Author should handle Ctrl/Cmd+Z (vs browser / no-op). */
export function shouldHandleAuthorUndo(options: {
  isUndoKey: boolean;
  focusIsEditable: boolean;
  canModeUndo: boolean;
  hasPendingReopen: boolean;
}): AuthorUndoAction | null {
  if (!options.isUndoKey || options.focusIsEditable) {
    return null;
  }
  if (options.canModeUndo) {
    return 'mode-undo';
  }
  if (options.hasPendingReopen) {
    return 'reopen';
  }
  return null;
}
