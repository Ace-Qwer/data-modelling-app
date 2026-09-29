import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export interface Platform {
  readonly isTauri: boolean;
  readonly isMac: boolean;
  readonly exit: () => void;
}

export function detectPlatform(): Platform {
  const inTauri = isTauri();
  return {
    isTauri: inTauri,
    isMac: navigator.userAgent.includes('Mac'),
    exit: () => {
      if (inTauri) void getCurrentWindow().close();
      else window.close();
    },
  };
}

// WebKit offers no other way to drive a text field's own undo stack from outside a keypress.
export function runTextCommand(command: 'undo' | 'redo'): void {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- see the comment above
  document.execCommand(command);
}
