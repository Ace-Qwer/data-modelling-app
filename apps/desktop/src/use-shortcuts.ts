import { useEffect } from 'react';
import type { Action, ActionContext } from './actions';
import type { ShortcutLog } from './menu/shortcut-log';
import { isMacPlatform, isTextEntryTarget, matchesShortcut } from './shortcuts';

export function useShortcuts(
  actions: readonly Action[],
  ctx: ActionContext,
  log: ShortcutLog,
): void {
  useEffect(() => {
    const isMac = isMacPlatform();
    const onKeyDown = (event: KeyboardEvent) => {
      const action = actions.find((a) =>
        a.shortcuts?.some((s) => matchesShortcut(event, s, isMac)),
      );
      if (!action) return;
      // A modal dialog owns the keyboard; nothing behind it may change.
      if (ctx.ui.getState().aboutOpen) return;
      log.note(action.id);
      // The field's own editing (text undo, Delete) handles keys while the user is typing.
      if (isTextEntryTarget(event.target)) return;
      if (!action.isEnabled(ctx)) return;
      event.preventDefault();
      action.run(ctx);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [actions, ctx, log]);
}
