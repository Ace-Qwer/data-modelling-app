import { renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TopMenu } from './menu-model';
import { useNativeMenu } from './native-menu';

// Tauri's menu API only exists inside the desktop shell; this stand-in records which menu became
// the app menu and which items were updated, which is all the adapter's contract covers.
const tauri = vi.hoisted(() => {
  interface Options {
    readonly id?: string;
    readonly items?: readonly unknown[];
  }
  class Item {
    readonly setEnabled = vi.fn(() => Promise.resolve());
    readonly setChecked = vi.fn(() => Promise.resolve());
    constructor(readonly options: Options) {}
    static new<T>(this: new (options: Options) => T, options: Options): Promise<T> {
      return Promise.resolve(new this(options));
    }
  }
  const appMenus: Item[] = [];
  class Menu extends Item {
    readonly setAsAppMenu = vi.fn(() => {
      appMenus.push(this);
      return Promise.resolve();
    });
  }
  return {
    appMenus,
    Item,
    Menu,
    MenuItem: class MenuItem extends Item {},
    CheckMenuItem: class CheckMenuItem extends Item {},
    Submenu: class Submenu extends Item {},
    PredefinedMenuItem: class PredefinedMenuItem extends Item {},
  };
});
vi.mock('@tauri-apps/api/menu', () => tauri);

function edit(enabled: boolean): readonly TopMenu[] {
  return [{ label: 'Edit', children: [{ kind: 'item', id: 'edit.undo', label: 'Undo', enabled }] }];
}

function undoItemOf(menu: InstanceType<typeof tauri.Item>): InstanceType<typeof tauri.Item> {
  const [submenu] = menu.options.items ?? [];
  const [item] = submenu instanceof tauri.Item ? (submenu.options.items ?? []) : [];
  if (!(item instanceof tauri.Item)) throw new Error('Undo item missing');
  return item;
}

describe('useNativeMenu', () => {
  it('under StrictMode sets one app menu and keeps syncing that same menu', async () => {
    const env = { isTauri: true, isMac: false };
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useNativeMenu(edit(enabled), env, () => undefined),
      { initialProps: { enabled: false }, wrapper: StrictMode },
    );
    await waitFor(() => {
      expect(result.current).toBe('active');
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(tauri.appMenus).toHaveLength(1);

    rerender({ enabled: true });

    const [shown] = tauri.appMenus;
    if (!shown) throw new Error('No app menu');
    await waitFor(() => {
      expect(undoItemOf(shown).setEnabled).toHaveBeenLastCalledWith(true);
    });
  });
  it('rebuilds the app menu when the menu structure changes, but not for state changes', async () => {
    tauri.appMenus.length = 0;
    const env = { isTauri: true, isMac: false };
    const withItems = (labels: readonly string[], enabled: boolean): readonly TopMenu[] => [
      {
        label: 'File',
        children: labels.map((label) => ({ kind: 'item', id: label, label, enabled })),
      },
    ];
    const { result, rerender } = renderHook(
      ({ menus }: { menus: readonly TopMenu[] }) => useNativeMenu(menus, env, () => undefined),
      { initialProps: { menus: withItems(['a'], true) } },
    );
    await waitFor(() => {
      expect(result.current).toBe('active');
    });

    rerender({ menus: withItems(['a'], false) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(tauri.appMenus).toHaveLength(1);

    rerender({ menus: withItems(['a', 'b'], false) });
    await waitFor(() => {
      expect(tauri.appMenus).toHaveLength(2);
    });
  });
});
