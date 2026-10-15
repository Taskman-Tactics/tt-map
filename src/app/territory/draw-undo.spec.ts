import { describe, expect, it } from 'vitest';
import {
  isEditableKeyboardTarget,
  isUndoKeyEvent,
  openRingVertices,
  shouldHandleAuthorUndo,
} from './draw-undo';

describe('openRingVertices', () => {
  it('strips a closing duplicate', () => {
    expect(
      openRingVertices([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ]),
    ).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
  });

  it('leaves an already-open ring unchanged', () => {
    expect(
      openRingVertices([
        [0, 0],
        [1, 0],
        [1, 1],
      ]),
    ).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
  });

  it('returns empty for an empty ring', () => {
    expect(openRingVertices([])).toEqual([]);
  });
});

describe('isUndoKeyEvent', () => {
  it('matches Ctrl+Z and Meta+Z without Shift', () => {
    expect(
      isUndoKeyEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }),
      ),
    ).toBe(true);
    expect(
      isUndoKeyEvent(
        new KeyboardEvent('keydown', { key: 'Z', metaKey: true }),
      ),
    ).toBe(true);
  });

  it('rejects redo and plain Z', () => {
    expect(
      isUndoKeyEvent(
        new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          shiftKey: true,
        }),
      ),
    ).toBe(false);
    expect(isUndoKeyEvent(new KeyboardEvent('keydown', { key: 'z' }))).toBe(
      false,
    );
  });
});

describe('shouldHandleAuthorUndo', () => {
  it('prefers mode undo while drawing history exists', () => {
    expect(
      shouldHandleAuthorUndo({
        isUndoKey: true,
        focusIsEditable: false,
        canModeUndo: true,
        hasPendingReopen: true,
      }),
    ).toBe('mode-undo');
  });

  it('reopens when mode undo is empty but a pending close exists', () => {
    expect(
      shouldHandleAuthorUndo({
        isUndoKey: true,
        focusIsEditable: false,
        canModeUndo: false,
        hasPendingReopen: true,
      }),
    ).toBe('reopen');
  });

  it('skips when focus is in an editable field', () => {
    expect(
      shouldHandleAuthorUndo({
        isUndoKey: true,
        focusIsEditable: true,
        canModeUndo: true,
        hasPendingReopen: true,
      }),
    ).toBeNull();
  });

  it('no-ops when there is nothing to undo', () => {
    expect(
      shouldHandleAuthorUndo({
        isUndoKey: true,
        focusIsEditable: false,
        canModeUndo: false,
        hasPendingReopen: false,
      }),
    ).toBeNull();
  });
});

describe('isEditableKeyboardTarget', () => {
  it('detects input and textarea elements', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const div = document.createElement('div');
    expect(isEditableKeyboardTarget(input)).toBe(true);
    expect(isEditableKeyboardTarget(textarea)).toBe(true);
    expect(isEditableKeyboardTarget(div)).toBe(false);
  });
});
