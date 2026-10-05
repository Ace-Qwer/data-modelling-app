import { vi } from 'vitest';
import type { Platform } from '../platform';
import { createMemoryFiles, createMemoryRecent } from './memory-files';

export function createTestPlatform(
  options: { disk?: Readonly<Record<string, string>>; recent?: string[] } = {},
) {
  const memory = createMemoryFiles(options.disk);
  const recent = createMemoryRecent(options.recent);
  const exit = vi.fn<() => void>();
  const titles: string[] = [];
  const close: { handler: (() => void) | null } = { handler: null };
  const platform: Platform = {
    isTauri: false,
    isMac: false,
    exit,
    textCommand: () => undefined,
    files: memory.files,
    recent,
    setTitle: (title) => {
      titles.push(title);
    },
    onCloseRequested: (handler) => {
      close.handler = handler;
      return () => {
        close.handler = null;
      };
    },
  };
  return { platform, memory, recent, exit, titles, requestClose: () => close.handler?.() };
}
