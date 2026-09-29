import { describe, expect, it } from 'vitest';
import { createShortcutLog } from './shortcut-log';

describe('ShortcutLog', () => {
  it('reports a keypress as recent within the duplicate window only', () => {
    const log = createShortcutLog();

    log.noteKey('edit.undo', 1000);

    expect(log.keyedRecently('edit.undo', 1100)).toBe(true);
    expect(log.keyedRecently('edit.undo', 1200)).toBe(false);
    expect(log.keyedRecently('edit.redo', 1100)).toBe(false);
  });

  it('keeps keypresses and native activations apart', () => {
    const log = createShortcutLog();

    log.noteNative('edit.undo', 1000);

    expect(log.nativeRecently('edit.undo', 1100)).toBe(true);
    expect(log.keyedRecently('edit.undo', 1100)).toBe(false);
  });

  it('knows nothing before any activity', () => {
    expect(createShortcutLog().nativeRecently('edit.undo', 0)).toBe(false);
  });
});
