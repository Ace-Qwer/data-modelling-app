import { describe, expect, it } from 'vitest';
import { createShortcutLog } from './shortcut-log';

describe('ShortcutLog', () => {
  it('reports an action as just keyed shortly after its keypress', () => {
    const log = createShortcutLog();

    log.note('edit.undo', 1000);

    expect(log.wasJustKeyed('edit.undo', 1100)).toBe(true);
    expect(log.wasJustKeyed('edit.redo', 1100)).toBe(false);
  });

  it('forgets a keypress once the duplicate window has passed', () => {
    const log = createShortcutLog();

    log.note('edit.undo', 1000);

    expect(log.wasJustKeyed('edit.undo', 1200)).toBe(false);
  });

  it('knows nothing before any keypress', () => {
    expect(createShortcutLog().wasJustKeyed('edit.undo', 0)).toBe(false);
  });
});
