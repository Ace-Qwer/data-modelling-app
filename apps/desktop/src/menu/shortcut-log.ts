// A native accelerator and the webview's keydown can both report one keypress, in either
// order; anything closer together than this is the same press.
const DUPLICATE_WINDOW_MS = 150;

export interface ShortcutLog {
  readonly noteKey: (actionId: string, now?: number) => void;
  readonly noteNative: (actionId: string, now?: number) => void;
  readonly keyedRecently: (actionId: string, now?: number) => boolean;
  readonly nativeRecently: (actionId: string, now?: number) => boolean;
}

function recorder() {
  const last = new Map<string, number>();
  return {
    note: (actionId: string, now = performance.now()) => {
      last.set(actionId, now);
    },
    recently: (actionId: string, now = performance.now()) => {
      const at = last.get(actionId);
      return at !== undefined && now - at < DUPLICATE_WINDOW_MS;
    },
  };
}

export function createShortcutLog(): ShortcutLog {
  const keys = recorder();
  const native = recorder();
  return {
    noteKey: keys.note,
    noteNative: native.note,
    keyedRecently: keys.recently,
    nativeRecently: native.recently,
  };
}
