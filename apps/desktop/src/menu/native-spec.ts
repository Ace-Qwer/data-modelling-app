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
  | { readonly type: 'submenu'; readonly text: string; readonly items: readonly NativeEntry[] }
  | { readonly type: 'separator' }
  | { readonly type: 'quit' };

// Only modifier combinations become native accelerators; a bare key such as Delete would be
// captured by the OS menu and stop working inside text fields.
export function toAccelerator(shortcut: string): string | undefined {
  return shortcut.includes('Mod+') ? shortcut.replace('Mod+', 'CmdOrCtrl+') : undefined;
}

export function toNativeEntries(nodes: readonly MenuNode[]): readonly NativeEntry[] {
  return nodes.map((node): NativeEntry => {
    switch (node.kind) {
      case 'separator':
        return { type: 'separator' };
      case 'submenu':
        return { type: 'submenu', text: node.label, items: toNativeEntries(node.children) };
      case 'item': {
        if (node.checked !== undefined) {
          return {
            type: 'check',
            id: node.id,
            text: node.label,
            enabled: node.enabled,
            checked: node.checked,
          };
        }
        const accelerator = node.shortcut === undefined ? undefined : toAccelerator(node.shortcut);
        return {
          type: 'item',
          id: node.id,
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
  const about = menus
    .flatMap((m) => m.children)
    .find((n) => n.kind === 'item' && n.id === 'help.about');
  const appItems: NativeEntry[] = [
    ...(about ? toNativeEntries([about]) : []),
    { type: 'separator' },
    { type: 'quit' },
  ];
  return [{ type: 'submenu', text: 'Data Modelling App', items: appItems }, ...entries];
}
