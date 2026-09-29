// A native accelerator and the webview's keydown can both report one keypress; anything
// closer together than this is the same press.
const DUPLICATE_WINDOW_MS = 150;

export interface ShortcutLog {
  readonly note: (actionId: string, now?: number) => void;
  readonly wasJustKeyed: (actionId: string, now?: number) => boolean;
}

export function createShortcutLog(): ShortcutLog {
  const lastKeyed = new Map<string, number>();
  return {
    note: (actionId, now = performance.now()) => {
      lastKeyed.set(actionId, now);
    },
    wasJustKeyed: (actionId, now = performance.now()) => {
      const at = lastKeyed.get(actionId);
      return at !== undefined && now - at < DUPLICATE_WINDOW_MS;
    },
  };
}
