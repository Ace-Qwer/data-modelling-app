import { useEffect } from 'react';
import type { Action, ActionContext } from './actions';
import { isMacPlatform, isTextEntryTarget, matchesShortcut } from './shortcuts';

export function useShortcuts(actions: readonly Action[], ctx: ActionContext): void {
  useEffect(() => {
    const isMac = isMacPlatform();
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEntryTarget(event.target)) return;
      const action = actions.find((a) =>
        a.shortcuts?.some((s) => matchesShortcut(event, s, isMac)),
      );
      if (!action?.isEnabled(ctx)) return;
      event.preventDefault();
      action.run(ctx);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [actions, ctx]);
}
