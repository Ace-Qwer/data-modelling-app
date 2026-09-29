import { describe, expect, it } from 'vitest';
import { addElement, createActionContext } from '../testing/fixture';
import { buildMenuBar, buildTreeContextMenu, runMenuItem, type MenuNode } from './menu-model';

const desktop = { isTauri: true, isMac: false };

function find(nodes: readonly MenuNode[], label: string): MenuNode {
  const node = nodes.find((n) => n.kind !== 'separator' && n.label === label);
  if (!node) throw new Error(`No menu node ${label}`);
  return node;
}

function children(node: MenuNode): readonly MenuNode[] {
  if (node.kind !== 'submenu') throw new Error('Not a submenu');
  return node.children;
}

function labels(nodes: readonly MenuNode[]): string[] {
  return nodes.map((n) => (n.kind === 'separator' ? '---' : n.label));
}

describe('buildMenuBar', () => {
  it('has StarUML-style top-level menus', () => {
    const { ctx } = createActionContext();

    expect(buildMenuBar(ctx, desktop).map((m) => m.label)).toEqual([
      'File',
      'Edit',
      'Model',
      'View',
      'Help',
    ]);
  });

  it('shows Exit in File only for Tauri on Windows and Linux', () => {
    const { ctx } = createActionContext();
    const file = (env: { isTauri: boolean; isMac: boolean }) =>
      labels(buildMenuBar(ctx, env)[0]?.children ?? []);

    expect(file(desktop)).toEqual(['New Project', '---', 'Exit']);
    expect(file({ isTauri: true, isMac: true })).toEqual(['New Project']);
    expect(file({ isTauri: false, isMac: false })).toEqual(['New Project']);
  });

  it('builds Model → Add and Add Diagram from the registry, enabled per selection', () => {
    const { ctx, ui, modelId } = createActionContext();
    ui.getState().select(modelId);

    const model = buildMenuBar(ctx, desktop)[2]?.children ?? [];
    const add = children(find(model, 'Add'));

    expect(labels(add)).toEqual(['Model', 'Package', 'Class']);
    expect(add.map((n) => n.kind === 'item' && n.enabled)).toEqual([false, true, true]);
    expect(labels(children(find(model, 'Add Diagram')))).toEqual(['Class Diagram']);
  });

  it('reports visible panels as checked View items', () => {
    const { ctx, ui } = createActionContext();
    ui.getState().togglePanel('explorer');

    const view = buildMenuBar(ctx, desktop)[3]?.children ?? [];

    expect(view.map((n) => n.kind === 'item' && n.checked)).toEqual([true, false, true]);
  });

  it('carries the first shortcut of each item', () => {
    const { ctx } = createActionContext();

    const edit = buildMenuBar(ctx, desktop)[1]?.children ?? [];

    expect(edit.map((n) => (n.kind === 'item' ? n.shortcut : undefined))).toEqual([
      'Mod+Z',
      'Mod+Shift+Z',
      undefined,
      'Delete',
    ]);
  });
});

describe('buildTreeContextMenu', () => {
  it('offers Add, Add Diagram and Delete for the selection', () => {
    const { ctx, ui, model, modelId } = createActionContext();
    ui.getState().select(addElement(model, 'core:Package', modelId, 'Ordering'));

    const menu = buildTreeContextMenu(ctx);

    expect(labels(menu)).toEqual(['Add', 'Add Diagram', '---', 'Delete']);
    expect(find(menu, 'Delete')).toMatchObject({ enabled: true });
  });
});

describe('runMenuItem', () => {
  it('runs an enabled action by id and ignores disabled or unknown ids', () => {
    const { ctx, ui, model, modelId } = createActionContext();
    ui.getState().select(modelId);

    runMenuItem('add.core:Package', ctx);
    runMenuItem('add.core:Model', ctx);
    runMenuItem('no.such.action', ctx);

    expect(model.children(modelId).map((e) => e.kind)).toEqual(['core:Package']);
  });
});
