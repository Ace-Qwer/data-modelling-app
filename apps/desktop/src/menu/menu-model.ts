import {
  addDiagramActions,
  addElementActions,
  allActions,
  editActions,
  fileActions,
  helpActions,
  recentActions,
  viewActions,
  type Action,
  type ActionContext,
} from '../actions';

export type MenuNode =
  | {
      readonly kind: 'item';
      readonly id: string;
      readonly label: string;
      readonly shortcut?: string;
      readonly enabled: boolean;
      readonly checked?: boolean;
    }
  | {
      readonly kind: 'submenu';
      readonly label: string;
      readonly enabled?: boolean;
      readonly children: readonly MenuNode[];
    }
  | { readonly kind: 'separator' };

export interface TopMenu {
  readonly label: string;
  readonly children: readonly MenuNode[];
}

export interface MenuEnvironment {
  readonly isTauri: boolean;
  readonly isMac: boolean;
}

const separator: MenuNode = { kind: 'separator' };

function item(action: Action, ctx: ActionContext): MenuNode {
  const shortcut = action.shortcuts?.[0];
  return {
    kind: 'item',
    id: action.id,
    label: action.label,
    enabled: action.isEnabled(ctx),
    ...(shortcut === undefined ? {} : { shortcut }),
    ...(action.isChecked ? { checked: action.isChecked(ctx) } : {}),
  };
}

function byId(actions: readonly Action[], id: string): Action {
  const action = actions.find((a) => a.id === id);
  if (!action) throw new Error(`Unknown action ${id}`);
  return action;
}

function addSubmenus(ctx: ActionContext): MenuNode[] {
  return [
    {
      kind: 'submenu',
      label: 'Add',
      children: addElementActions(ctx.registry).map((a) => item(a, ctx)),
    },
    {
      kind: 'submenu',
      label: 'Add Diagram',
      children: addDiagramActions(ctx.registry).map((a) => item(a, ctx)),
    },
  ];
}

export function buildMenuBar(ctx: ActionContext, env: MenuEnvironment): readonly TopMenu[] {
  // macOS puts Quit in the app menu, and outside Tauri there is no window to exit.
  const showExit = env.isTauri && !env.isMac;
  return [
    {
      label: 'File',
      children: [
        item(byId(fileActions, 'file.new'), ctx),
        item(byId(fileActions, 'file.open'), ctx),
        {
          kind: 'submenu',
          label: 'Open Recent',
          enabled: ctx.canUseFiles && ctx.recentProjects.length > 0,
          children: [
            ...recentActions(ctx.recentProjects).map((a) => item(a, ctx)),
            separator,
            item(byId(fileActions, 'file.clearRecent'), ctx),
          ],
        },
        separator,
        item(byId(fileActions, 'file.save'), ctx),
        item(byId(fileActions, 'file.saveAs'), ctx),
        ...(showExit ? [separator, item(byId(fileActions, 'file.exit'), ctx)] : []),
      ],
    },
    {
      label: 'Edit',
      children: [
        item(byId(editActions, 'edit.undo'), ctx),
        item(byId(editActions, 'edit.redo'), ctx),
        separator,
        item(byId(editActions, 'edit.delete'), ctx),
      ],
    },
    { label: 'Model', children: addSubmenus(ctx) },
    { label: 'View', children: viewActions.map((a) => item(a, ctx)) },
    { label: 'Help', children: helpActions.map((a) => item(a, ctx)) },
  ];
}

export function buildTreeContextMenu(ctx: ActionContext): readonly MenuNode[] {
  return [...addSubmenus(ctx), separator, item(byId(editActions, 'edit.delete'), ctx)];
}

export function runMenuItem(id: string, ctx: ActionContext): void {
  const action = [...allActions(ctx.registry), ...recentActions(ctx.recentProjects)].find(
    (a) => a.id === id,
  );
  if (action?.isEnabled(ctx)) action.run(ctx);
}
