import { useEffect } from 'react';
import type { Action, ActionContext } from './actions';
import type { ShortcutLog } from './menu/shortcut-log';
import { handleShortcutKey } from './menu/shortcut-routing';
import { isMacPlatform } from './shortcuts';

export function useShortcuts(
  actions: readonly Action[],
  ctx: ActionContext,
  log: ShortcutLog,
): void {
  useEffect(() => {
    const isMac = isMacPlatform();
    const onKeyDown = (event: KeyboardEvent) => {
      handleShortcutKey(event, actions, ctx, log, isMac);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [actions, ctx, log]);
}
