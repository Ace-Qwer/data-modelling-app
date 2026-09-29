import type { Action, ActionContext } from '../actions';
import { isTextEntryTarget, matchesShortcut, type KeyInput } from '../shortcuts';
import type { ShortcutLog } from './shortcut-log';

export interface ShortcutKey extends KeyInput {
  readonly target: EventTarget | null;
  readonly preventDefault: () => void;
}

export function handleNativeActivation(
  id: string,
  log: ShortcutLog,
  run: (id: string) => void,
  now = performance.now(),
): void {
  if (log.keyedRecently(id, now)) return;
  log.noteNative(id, now);
  run(id);
}

export function handleShortcutKey(
  key: ShortcutKey,
  actions: readonly Action[],
  ctx: ActionContext,
  log: ShortcutLog,
  isMac: boolean,
  now = performance.now(),
): void {
  const action = actions.find((a) => a.shortcuts?.some((s) => matchesShortcut(key, s, isMac)));
  if (!action) return;
  if (ctx.ui.getState().aboutOpen) return;
  if (log.nativeRecently(action.id, now)) {
    key.preventDefault();
    return;
  }
  log.noteKey(action.id, now);
  // While typing, the field's own editing handles keys like Delete; only actions that know how
  // to act on text (undo/redo) take over, so every platform undoes text exactly once.
  if (isTextEntryTarget(key.target) && action.handlesTextEntry !== true) return;
  if (!action.isEnabled(ctx)) return;
  key.preventDefault();
  action.run(ctx);
}
