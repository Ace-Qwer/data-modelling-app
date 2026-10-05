import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { ProjectFiles, RecentProjects } from './files/ports';
import { createTauriFiles } from './files/tauri-files';
import { createTauriRecent } from './files/tauri-recent';

export interface Platform {
  readonly isTauri: boolean;
  readonly isMac: boolean;
  readonly exit: () => void;
  readonly textCommand: (command: 'undo' | 'redo') => void;
  readonly files: ProjectFiles | null;
  readonly recent: RecentProjects | null;
  readonly setTitle: (title: string) => void;
  readonly onCloseRequested: (handler: () => void) => () => void;
}

export function detectPlatform(): Platform {
  const inTauri = isTauri();
  return {
    isTauri: inTauri,
    isMac: navigator.userAgent.includes('Mac'),
    // destroy() skips the close-requested hook, which already asked about unsaved changes.
    exit: () => {
      if (inTauri) void getCurrentWindow().destroy();
      else window.close();
    },
    textCommand: runTextCommand,
    files: inTauri ? createTauriFiles() : null,
    recent: inTauri ? createTauriRecent() : null,
    setTitle: (title) => {
      if (inTauri) void getCurrentWindow().setTitle(title);
      else document.title = title;
    },
    onCloseRequested: (handler) => {
      if (!inTauri) return () => undefined;
      const subscription = { unlisten: null as (() => void) | null, cancelled: false };
      void getCurrentWindow()
        .onCloseRequested((event) => {
          event.preventDefault();
          handler();
        })
        .then((unlisten) => {
          if (subscription.cancelled) unlisten();
          else subscription.unlisten = unlisten;
        });
      return () => {
        subscription.cancelled = true;
        subscription.unlisten?.();
      };
    },
  };
}

// WebKit offers no other way to drive a text field's own undo stack from outside a keypress.
export function runTextCommand(command: 'undo' | 'redo'): void {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- see the comment above
  document.execCommand(command);
}
