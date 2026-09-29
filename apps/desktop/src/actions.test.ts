import { describe, expect, it } from 'vitest';
import { addActions, editActions, fileActions, type Action } from './actions';
import { addElement, createActionContext } from './testing/fixture';

function action(actions: readonly Action[], id: string): Action {
  const found = actions.find((a) => a.id === id);
  if (!found) throw new Error(`No action ${id}`);
  return found;
}

describe('Add actions', () => {
  it('offer every registered kind except the project root', () => {
    const { registry } = createActionContext();

    expect(addActions(registry).map((a) => a.id)).toEqual([
      'add.core:Model',
      'add.core:Package',
      'add.uml:ClassDiagram',
      'add.uml:Class',
    ]);
  });

  it('are enabled only for kinds the selected element may own', () => {
    const { registry, ctx, ui, modelId } = createActionContext();
    ui.getState().select(modelId);

    const enabled = addActions(registry)
      .filter((a) => a.isEnabled(ctx))
      .map((a) => a.label);

    expect(enabled).toEqual(['Package', 'Class Diagram', 'Class']);
  });

  it('are all disabled when nothing is selected', () => {
    const { registry, ctx } = createActionContext();

    expect(addActions(registry).some((a) => a.isEnabled(ctx))).toBe(false);
  });

  it('are all disabled when the selected element owns nothing', () => {
    const { registry, ctx, ui, model, modelId } = createActionContext();
    ui.getState().select(addElement(model, 'uml:Class', modelId, 'Order'));

    expect(addActions(registry).some((a) => a.isEnabled(ctx))).toBe(false);
  });

  it('create a "New <Kind>" element under the selection, then select and reveal it', () => {
    const { registry, ctx, ui, model, modelId } = createActionContext();
    ui.getState().select(modelId);
    ui.getState().toggleCollapsed(modelId);

    action(addActions(registry), 'add.core:Package').run(ctx);

    const [created] = model.children(modelId);
    expect(created).toMatchObject({ kind: 'core:Package', name: 'New Package' });
    expect(ui.getState().selectedId).toBe(created?.id);
    expect(ui.getState().collapsedIds.has(modelId)).toBe(false);
  });
});

describe('Edit actions', () => {
  it('enable undo and redo according to the model history', () => {
    const { ctx, model, modelId } = createActionContext();
    const undo = action(editActions, 'edit.undo');
    const redo = action(editActions, 'edit.redo');
    expect(undo.isEnabled(ctx)).toBe(false);

    addElement(model, 'core:Package', modelId, 'Ordering');
    expect(undo.isEnabled(ctx)).toBe(true);

    undo.run(ctx);
    expect(model.children(modelId)).toEqual([]);
    expect(redo.isEnabled(ctx)).toBe(true);

    redo.run(ctx);
    expect(model.children(modelId)).toHaveLength(1);
  });

  it('bind undo to Mod+Z and redo to both Mod+Shift+Z and Mod+Y', () => {
    expect(action(editActions, 'edit.undo').shortcuts).toEqual(['Mod+Z']);
    expect(action(editActions, 'edit.redo').shortcuts).toEqual(['Mod+Shift+Z', 'Mod+Y']);
  });

  it('never allow deleting the project root or the Model', () => {
    const { ctx, ui, model, modelId } = createActionContext();
    const del = action(editActions, 'edit.delete');

    ui.getState().select(model.root.id);
    expect(del.isEnabled(ctx)).toBe(false);
    ui.getState().select(modelId);
    expect(del.isEnabled(ctx)).toBe(false);
    ui.getState().select(null);
    expect(del.isEnabled(ctx)).toBe(false);
  });

  it('delete the selected package', () => {
    const { ctx, ui, model, modelId } = createActionContext();
    const pkg = addElement(model, 'core:Package', modelId, 'Ordering');
    ui.getState().select(pkg);
    const del = action(editActions, 'edit.delete');

    expect(del.isEnabled(ctx)).toBe(true);
    del.run(ctx);

    expect(model.getElement(pkg)).toBeUndefined();
  });
});

describe('File actions', () => {
  it('start a new project through the context', () => {
    const { ctx, newProject } = createActionContext();

    action(fileActions, 'file.new').run(ctx);

    expect(newProject).toHaveBeenCalledOnce();
  });

  it('keep Open and Save disabled until persistence exists', () => {
    const { ctx } = createActionContext();

    expect(action(fileActions, 'file.open').isEnabled(ctx)).toBe(false);
    expect(action(fileActions, 'file.save').isEnabled(ctx)).toBe(false);
  });
});
