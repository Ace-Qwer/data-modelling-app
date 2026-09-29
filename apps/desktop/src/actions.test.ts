import { describe, expect, it } from 'vitest';
import {
  addDiagramActions,
  addElementActions,
  allActions,
  editActions,
  fileActions,
  helpActions,
  viewActions,
  type Action,
} from './actions';
import { addElement as addFixtureElement, createActionContext } from './testing/fixture';

function action(actions: readonly Action[], id: string): Action {
  const found = actions.find((a) => a.id === id);
  if (!found) throw new Error(`No action ${id}`);
  return found;
}

describe('Add actions', () => {
  it('split element kinds from diagram kinds', () => {
    const { registry } = createActionContext();

    expect(addElementActions(registry).map((a) => a.id)).toEqual([
      'add.core:Model',
      'add.core:Package',
      'add.uml:Class',
    ]);
    expect(addDiagramActions(registry).map((a) => a.id)).toEqual(['add.uml:ClassDiagram']);
  });

  it('are enabled only for kinds the selected element may own', () => {
    const { registry, ctx, ui, modelId } = createActionContext();
    ui.getState().select(modelId);

    expect(
      addElementActions(registry)
        .filter((a) => a.isEnabled(ctx))
        .map((a) => a.label),
    ).toEqual(['Package', 'Class']);
    expect(addDiagramActions(registry).every((a) => a.isEnabled(ctx))).toBe(true);
  });

  it('are all disabled when nothing is selected', () => {
    const { registry, ctx } = createActionContext();

    expect(
      allActions(registry)
        .filter((a) => a.id.startsWith('add.'))
        .some((a) => a.isEnabled(ctx)),
    ).toBe(false);
  });

  it('create a "New <Kind>" element under the selection, then select and reveal it', () => {
    const { registry, ctx, ui, model, modelId } = createActionContext();
    ui.getState().select(modelId);
    ui.getState().toggleCollapsed(modelId);

    action(addElementActions(registry), 'add.core:Package').run(ctx);

    const [created] = model.children(modelId);
    expect(created).toMatchObject({ kind: 'core:Package', name: 'New Package' });
    expect(ui.getState().selectedId).toBe(created?.id);
    expect(ui.getState().collapsedIds.has(modelId)).toBe(false);
  });
});

describe('Edit actions', () => {
  it('undo and redo the model when no text field has focus', () => {
    const { ctx, model, modelId, textCommand } = createActionContext();
    const undo = action(editActions, 'edit.undo');
    const redo = action(editActions, 'edit.redo');
    expect(undo.isEnabled(ctx)).toBe(false);

    addFixtureElement(model, 'core:Package', modelId, 'Ordering');
    undo.run(ctx);
    expect(model.children(modelId)).toEqual([]);

    redo.run(ctx);
    expect(model.children(modelId)).toHaveLength(1);
    expect(textCommand).not.toHaveBeenCalled();
  });

  it('undo and redo the focused text field instead of the model', () => {
    const { ctx, model, modelId, textCommand } = createActionContext();
    addFixtureElement(model, 'core:Package', modelId, 'Ordering');
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    try {
      expect(action(editActions, 'edit.undo').isEnabled(ctx)).toBe(true);
      expect(action(editActions, 'edit.redo').isEnabled(ctx)).toBe(true);
      action(editActions, 'edit.undo').run(ctx);
      action(editActions, 'edit.redo').run(ctx);
    } finally {
      input.remove();
    }

    expect(textCommand.mock.calls).toEqual([['undo'], ['redo']]);
    expect(model.children(modelId)).toHaveLength(1);
  });

  it('never allow deleting the project root or the only Model', () => {
    const { ctx, ui, model, modelId } = createActionContext();
    const del = action(editActions, 'edit.delete');

    ui.getState().select(model.root.id);
    expect(del.isEnabled(ctx)).toBe(false);
    ui.getState().select(modelId);
    expect(del.isEnabled(ctx)).toBe(false);
    ui.getState().select(null);
    expect(del.isEnabled(ctx)).toBe(false);
  });

  it('allow deleting a Model while another one remains', () => {
    const { ctx, ui, model, modelId } = createActionContext();
    const second = addFixtureElement(model, 'core:Model', model.root.id, 'Second');
    const del = action(editActions, 'edit.delete');

    ui.getState().select(modelId);
    expect(del.isEnabled(ctx)).toBe(true);
    del.run(ctx);

    ui.getState().select(second);
    expect(del.isEnabled(ctx)).toBe(false);
  });
});

describe('File, View and Help actions', () => {
  it('start a new project and exit through the context', () => {
    const { ctx, newProject, exit } = createActionContext();

    action(fileActions, 'file.new').run(ctx);
    action(fileActions, 'file.exit').run(ctx);

    expect(newProject).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledOnce();
  });

  it('toggle panels and report them as checked while visible', () => {
    const { ctx, ui } = createActionContext();
    const toolbox = action(viewActions, 'view.toolbox');
    expect(toolbox.isChecked?.(ctx)).toBe(true);

    toolbox.run(ctx);

    expect(ui.getState().hiddenPanels.has('toolbox')).toBe(true);
    expect(toolbox.isChecked?.(ctx)).toBe(false);
  });

  it('open the About dialog', () => {
    const { ctx, ui } = createActionContext();

    action(helpActions, 'help.about').run(ctx);

    expect(ui.getState().aboutOpen).toBe(true);
  });
});
