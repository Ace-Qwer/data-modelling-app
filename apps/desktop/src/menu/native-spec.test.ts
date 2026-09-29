import { describe, expect, it } from 'vitest';
import type { TopMenu } from './menu-model';
import { toAccelerator, toNativeSpec } from './native-spec';

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
    children: [
      { kind: 'item', id: 'help.about', label: 'About Data Modelling App', enabled: true },
    ],
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
        items: [
          { type: 'item', id: 'help.about', text: 'About Data Modelling App', enabled: true },
        ],
      },
    ]);
  });

  it('prepends the macOS app menu with About and Quit', () => {
    const [appMenu] = toNativeSpec(menus, { isTauri: true, isMac: true });

    expect(appMenu).toEqual({
      type: 'submenu',
      text: 'Data Modelling App',
      items: [
        { type: 'item', id: 'help.about', text: 'About Data Modelling App', enabled: true },
        { type: 'separator' },
        { type: 'quit' },
      ],
    });
  });
});
