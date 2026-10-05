import { describe, expect, it } from 'vitest';
import type { TopMenu } from './menu-model';
import {
  CONTEXT_ID_PREFIX,
  fromContextId,
  toAccelerator,
  toNativeEntries,
  toNativeSpec,
  type NativeEntry,
} from './native-spec';

const menus: readonly TopMenu[] = [
  {
    label: 'Edit',
    children: [
      { kind: 'item', id: 'edit.undo', label: 'Undo', shortcut: 'Mod+Z', enabled: true },
      { kind: 'separator' },
      { kind: 'item', id: 'edit.delete', label: 'Delete', shortcut: 'Delete', enabled: false },
    ],
  },
  {
    label: 'View',
    children: [
      { kind: 'item', id: 'view.toolbox', label: 'Toolbox', enabled: true, checked: true },
    ],
  },
  {
    label: 'Help',
    children: [{ kind: 'item', id: 'help.about', label: 'About Schemata', enabled: true }],
  },
];

describe('toAccelerator', () => {
  it.each([
    ['Mod+Z', 'CmdOrCtrl+Z'],
    ['Mod+Shift+Z', 'CmdOrCtrl+Shift+Z'],
    ['Delete', undefined],
  ])('maps %s to %s', (shortcut, accelerator) => {
    expect(toAccelerator(shortcut)).toBe(accelerator);
  });
});

describe('toNativeSpec', () => {
  it('turns menus into submenus with items, separators and check items', () => {
    expect(toNativeSpec(menus, { isTauri: true, isMac: false })).toEqual([
      {
        type: 'submenu',
        text: 'Edit',
        items: [
          {
            type: 'item',
            id: 'edit.undo',
            text: 'Undo',
            enabled: true,
            accelerator: 'CmdOrCtrl+Z',
          },
          { type: 'separator' },
          { type: 'item', id: 'edit.delete', text: 'Delete', enabled: false },
        ],
      },
      {
        type: 'submenu',
        text: 'View',
        items: [
          { type: 'check', id: 'view.toolbox', text: 'Toolbox', enabled: true, checked: true },
        ],
      },
      {
        type: 'submenu',
        text: 'Help',
        items: [{ type: 'item', id: 'help.about', text: 'About Schemata', enabled: true }],
      },
    ]);
  });

  // The predefined Quit item terminates the app without a close request, skipping the prompt.
  it('prepends the macOS app menu with About and a Quit that runs the exit flow', () => {
    const [appMenu] = toNativeSpec(menus, { isTauri: true, isMac: true });

    expect(appMenu).toEqual({
      type: 'submenu',
      text: 'Schemata',
      items: [
        { type: 'item', id: 'help.about', text: 'About Schemata', enabled: true },
        { type: 'separator' },
        {
          type: 'item',
          id: 'file.exit',
          text: 'Quit Schemata',
          enabled: true,
          accelerator: 'CmdOrCtrl+Q',
        },
      ],
    });
  });

  it('gives the macOS Edit menu the clipboard items text fields rely on', () => {
    const edit = toNativeSpec(menus, { isTauri: true, isMac: true }).find(
      (entry) => entry.type === 'submenu' && entry.text === 'Edit',
    );

    expect(edit?.type === 'submenu' ? edit.items.slice(-5) : []).toEqual([
      { type: 'separator' },
      { type: 'predefined', item: 'Cut' },
      { type: 'predefined', item: 'Copy' },
      { type: 'predefined', item: 'Paste' },
      { type: 'predefined', item: 'SelectAll' },
    ]);
  });

  it('gives context-menu items ids that never collide with the menu bar', () => {
    const ids = (entries: readonly NativeEntry[]): string[] =>
      entries.flatMap((e) => (e.type === 'submenu' ? ids(e.items) : 'id' in e ? [e.id] : []));
    const context = toNativeEntries(
      menus.flatMap((m) => m.children),
      CONTEXT_ID_PREFIX,
    );

    const contextIds = ids(context);
    const barIds = new Set(ids(toNativeSpec(menus, { isTauri: true, isMac: true })));

    expect(contextIds.length).toBeGreaterThan(0);
    expect(contextIds.filter((id) => barIds.has(id))).toEqual([]);
    expect(contextIds.map(fromContextId)).toEqual([
      'edit.undo',
      'edit.delete',
      'view.toolbox',
      'help.about',
    ]);
  });
  it('carries a submenu enabled state to the native menu', () => {
    const spec = toNativeSpec(
      [
        {
          label: 'File',
          children: [{ kind: 'submenu', label: 'Open Recent', enabled: false, children: [] }],
        },
      ],
      { isTauri: true, isMac: false },
    );

    expect(spec).toEqual([
      {
        type: 'submenu',
        text: 'File',
        items: [{ type: 'submenu', text: 'Open Recent', enabled: false, items: [] }],
      },
    ]);
  });
});
