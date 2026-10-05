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
type Handles = Map<string, MenuItem | CheckMenuItem | Submenu>;

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
      case 'submenu': {
        const submenu = await Submenu.new({
          text: entry.text,
          ...(entry.enabled === undefined ? {} : { enabled: entry.enabled }),
          items: await build(entry.items, onAction, handles),
        });
        handles.set(submenuKey(entry.text), submenu);
        items.push(submenu);
        break;
      }
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

// Submenus have no id of their own; their text is unique within the menus we build.
function submenuKey(text: string): string {
  return `submenu:${text}`;
}

function flatten(entries: readonly NativeEntry[]): NativeEntry[] {
  return entries.flatMap((e) => (e.type === 'submenu' ? [e, ...flatten(e.items)] : [e]));
}

async function sync(entries: readonly NativeEntry[], handles: Handles): Promise<void> {
  for (const entry of flatten(entries)) {
    if (entry.type === 'submenu') {
      if (entry.enabled !== undefined)
        await handles.get(submenuKey(entry.text))?.setEnabled(entry.enabled);
      continue;
    }
    if (entry.type !== 'item' && entry.type !== 'check') continue;
    const handle = handles.get(entry.id);
    if (!handle) continue;
    await handle.setEnabled(entry.enabled);
    if (entry.type === 'check' && handle instanceof CheckMenuItem)
      await handle.setChecked(entry.checked);
  }
}

export type NativeMenuState = 'off' | 'pending' | 'active' | 'failed';

function structureOf(entries: readonly NativeEntry[]): unknown {
  return entries.map((e) => {
    switch (e.type) {
      case 'submenu':
        return { type: e.type, text: e.text, items: structureOf(e.items) };
      case 'item':
      case 'check':
        return { type: e.type, id: e.id, text: e.text };
      default:
        return e;
    }
  });
}

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
  const structureKey = JSON.stringify(structureOf(spec));

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
    // Rebuilt only when items are added or removed (Open Recent); state changes flow through the
    // sync effect below. Old app menus stay open: closing their items would unregister handlers
    // for ids the new menu reuses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env.isTauri, structureKey]);

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
