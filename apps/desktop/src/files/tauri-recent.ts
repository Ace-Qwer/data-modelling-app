import { LazyStore } from '@tauri-apps/plugin-store';
import type { RecentProjects } from './ports';
import { pushRecent, withoutRecent } from './recent-list';

const KEY = 'recentProjects';

export function createTauriRecent(): RecentProjects {
  const store = new LazyStore('settings.json');
  const read = async (): Promise<readonly string[]> => {
    const stored = await store.get<unknown>(KEY);
    return Array.isArray(stored) ? stored.filter((p): p is string => typeof p === 'string') : [];
  };
  const write = async (list: readonly string[]) => {
    await store.set(KEY, list);
    await store.save();
    return list;
  };
  return {
    list: read,
    add: async (path) => write(pushRecent(await read(), path)),
    remove: async (path) => write(withoutRecent(await read(), path)),
    clear: async () => {
      await write([]);
    },
  };
}
