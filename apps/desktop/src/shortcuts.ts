export interface KeyInput {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

export function matchesShortcut(event: KeyInput, shortcut: string, isMac: boolean): boolean {
  const parts = shortcut.split('+');
  const key = parts.at(-1)?.toLowerCase();
  const modifiers = new Set(parts.slice(0, -1));
  const mod = isMac ? event.metaKey : event.ctrlKey;
  const otherPlatformMod = isMac ? event.ctrlKey : event.metaKey;
  return (
    event.key.toLowerCase() === key &&
    mod === modifiers.has('Mod') &&
    !otherPlatformMod &&
    event.shiftKey === modifiers.has('Shift') &&
    event.altKey === modifiers.has('Alt')
  );
}

export function formatShortcut(shortcut: string, isMac: boolean): string {
  return shortcut.replace('Mod', isMac ? '⌘' : 'Ctrl');
}

const TEXT_ENTRY_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

// Shortcuts such as Delete must edit text, not the model, while the user is typing.
export function isTextEntryTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (TEXT_ENTRY_TAGS.has(target.tagName) ||
      target.closest('[contenteditable=""], [contenteditable="true"]') !== null)
  );
}

export function isMacPlatform(): boolean {
  return navigator.userAgent.includes('Mac');
}
