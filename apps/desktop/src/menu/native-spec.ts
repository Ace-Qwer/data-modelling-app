import type { MenuEnvironment, MenuNode, TopMenu } from './menu-model';

export type NativeEntry =
  | {
      readonly type: 'item';
      readonly id: string;
      readonly text: string;
      readonly enabled: boolean;
      readonly accelerator?: string;
    }
  | {
      readonly type: 'check';
      readonly id: string;
      readonly text: string;
      readonly enabled: boolean;
      readonly checked: boolean;
    }
  | {
      readonly type: 'submenu';
      readonly text: string;
      readonly enabled?: boolean;
      readonly items: readonly NativeEntry[];
    }
  | { readonly type: 'separator' }
  | { readonly type: 'predefined'; readonly item: 'Cut' | 'Copy' | 'Paste' | 'SelectAll' };

// Only modifier combinations become native accelerators; a bare key such as Delete would be
// captured by the OS menu and stop working inside text fields.
export function toAccelerator(shortcut: string): string | undefined {
  return shortcut.includes('Mod+') ? shortcut.replace('Mod+', 'CmdOrCtrl+') : undefined;
}

// Tauri keeps one handler per menu item id across all menus, so a popup reusing the menu
// bar's ids would re-point the bar's items at the popup's handler.
export const CONTEXT_ID_PREFIX = 'context:';

export function fromContextId(id: string): string {
  return id.startsWith(CONTEXT_ID_PREFIX) ? id.slice(CONTEXT_ID_PREFIX.length) : id;
}

export function toNativeEntries(nodes: readonly MenuNode[], idPrefix = ''): readonly NativeEntry[] {
  return nodes.map((node): NativeEntry => {
    switch (node.kind) {
      case 'separator':
        return { type: 'separator' };
      case 'submenu':
        return {
          type: 'submenu',
          text: node.label,
          ...(node.enabled === undefined ? {} : { enabled: node.enabled }),
          items: toNativeEntries(node.children, idPrefix),
        };
      case 'item': {
        if (node.checked !== undefined) {
          return {
            type: 'check',
            id: idPrefix + node.id,
            text: node.label,
            enabled: node.enabled,
            checked: node.checked,
          };
        }
        const accelerator = node.shortcut === undefined ? undefined : toAccelerator(node.shortcut);
        return {
          type: 'item',
          id: idPrefix + node.id,
          text: node.label,
          enabled: node.enabled,
          ...(accelerator === undefined ? {} : { accelerator }),
        };
      }
    }
  });
}

export function toNativeSpec(
  menus: readonly TopMenu[],
  env: MenuEnvironment,
): readonly NativeEntry[] {
  const entries = menus.map((menu): NativeEntry => ({
    type: 'submenu',
    text: menu.label,
    items: toNativeEntries(menu.children),
  }));
  if (!env.isMac) return entries;
  // WKWebView routes Cmd+X/C/V/A in text fields through these menu items; without them the
  // clipboard shortcuts stop working once our menu replaces the default one.
  const withClipboard = entries.map((entry): NativeEntry =>
    entry.type === 'submenu' && entry.text === 'Edit'
      ? {
          ...entry,
          items: [
            ...entry.items,
            { type: 'separator' },
            { type: 'predefined', item: 'Cut' },
            { type: 'predefined', item: 'Copy' },
            { type: 'predefined', item: 'Paste' },
            { type: 'predefined', item: 'SelectAll' },
          ],
        }
      : entry,
  );
  const about = menus
    .flatMap((m) => m.children)
    .find((n) => n.kind === 'item' && n.id === 'help.about');
  const appItems: NativeEntry[] = [
    ...(about ? toNativeEntries([about]) : []),
    { type: 'separator' },
    // Not the predefined Quit: that terminates the app without a close request, so the
    // unsaved-changes prompt would never appear.
    {
      type: 'item',
      id: 'file.exit',
      text: 'Quit Data Modelling App',
      enabled: true,
      accelerator: 'CmdOrCtrl+Q',
    },
  ];
  return [{ type: 'submenu', text: 'Data Modelling App', items: appItems }, ...withClipboard];
}
