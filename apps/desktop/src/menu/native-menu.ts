import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';
import { useEffect, useEffectEvent, useState } from 'react';
import type { MenuEnvironment, MenuNode, TopMenu } from './menu-model';
import {
  CONTEXT_ID_PREFIX,
  fromContextId,
  toNativeEntries,
  toNativeSpec,
  type NativeEntry,
} from './native-spec';

type NativeItem = MenuItem | CheckMenuItem | Submenu | PredefinedMenuItem;
type Handles = Map<string, MenuItem | CheckMenuItem>;

async function build(
  entries: readonly NativeEntry[],
  onAction: (id: string) => void,
  handles: Handles,
): Promise<NativeItem[]> {
  const items: NativeItem[] = [];
  for (const entry of entries) {
    switch (entry.type) {
      case 'separator':
        items.push(await PredefinedMenuItem.new({ item: 'Separator' }));
        break;
      case 'quit':
        items.push(await PredefinedMenuItem.new({ item: 'Quit' }));
        break;
      case 'predefined':
        items.push(await PredefinedMenuItem.new({ item: entry.item }));
        break;
      case 'submenu':
        items.push(
          await Submenu.new({
            text: entry.text,
            items: await build(entry.items, onAction, handles),
          }),
        );
        break;
      case 'check': {
        const check = await CheckMenuItem.new({
          id: entry.id,
          text: entry.text,
          enabled: entry.enabled,
          checked: entry.checked,
          action: onAction,
        });
        handles.set(entry.id, check);
        items.push(check);
        break;
      }
      case 'item': {
        const item = await MenuItem.new({
          id: entry.id,
          text: entry.text,
          enabled: entry.enabled,
          ...(entry.accelerator === undefined ? {} : { accelerator: entry.accelerator }),
          action: onAction,
        });
        handles.set(entry.id, item);
        items.push(item);
        break;
      }
    }
  }
  return items;
}

function flatten(entries: readonly NativeEntry[]): NativeEntry[] {
  return entries.flatMap((e) => (e.type === 'submenu' ? flatten(e.items) : [e]));
}

async function sync(entries: readonly NativeEntry[], handles: Handles): Promise<void> {
  for (const entry of flatten(entries)) {
    if (entry.type !== 'item' && entry.type !== 'check') continue;
    const handle = handles.get(entry.id);
    if (!handle) continue;
    await handle.setEnabled(entry.enabled);
    if (entry.type === 'check' && handle instanceof CheckMenuItem)
      await handle.setChecked(entry.checked);
  }
}

export type NativeMenuState = 'off' | 'pending' | 'active' | 'failed';

// Builds the OS menu once, then only updates enabled and checked states: the menu's
// structure depends on the registry and platform, which never change while the app runs.
export function useNativeMenu(
  menus: readonly TopMenu[],
  env: MenuEnvironment,
  onAction: (id: string) => void,
): NativeMenuState {
  const [state, setState] = useState<NativeMenuState>(env.isTauri ? 'pending' : 'off');
  const [handles] = useState<Handles>(() => new Map());
  const handleAction = useEffectEvent(onAction);
  const spec = toNativeSpec(menus, env);
  const specKey = JSON.stringify(spec);

  useEffect(() => {
    if (!env.isTauri) return;
    const effect = { cancelled: false };
    void (async () => {
      try {
        // StrictMode starts this effect twice; only the build that is still wanted may become the
        // app menu and hand its items to the sync effect.
        const built: Handles = new Map();
        const items = await build(
          toNativeSpec(menus, env),
          (id) => {
            handleAction(id);
          },
          built,
        );
        const menu = await Menu.new({ items });
        if (effect.cancelled) return;
        await menu.setAsAppMenu();
        handles.clear();
        for (const [id, item] of built) handles.set(id, item);
        setState('active');
      } catch (error) {
        console.error('Native menu unavailable, using the in-window menu instead', error);
        if (!effect.cancelled) setState('failed');
      }
    })();
    return () => {
      effect.cancelled = true;
    };
    // Built once per platform; later changes flow through the sync effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env.isTauri]);

  useEffect(() => {
    if (state !== 'active') return;
    void sync(JSON.parse(specKey) as readonly NativeEntry[], handles);
  }, [state, specKey, handles]);

  return state;
}

let lastContextMenu: Menu | null = null;

export async function showNativeContextMenu(
  nodes: readonly MenuNode[],
  onAction: (id: string) => void,
): Promise<void> {
  // Closing the previous popup frees its native items. The current one can't be closed right
  // after popup(): on Linux that call returns while the menu is still open.
  await lastContextMenu?.close();
  const items = await build(
    toNativeEntries(nodes, CONTEXT_ID_PREFIX),
    (id) => {
      onAction(fromContextId(id));
    },
    new Map(),
  );
  const menu = await Menu.new({ items });
  lastContextMenu = menu;
  await menu.popup();
}
