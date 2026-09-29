import { describe, expect, it, vi } from 'vitest';
import { setup, thing } from './testing';

describe('history', () => {
  it('starts with nothing to undo or redo', () => {
    const { model } = setup();

    expect(model.canUndo).toBe(false);
    expect(model.canRedo).toBe(false);
  });

  it('undoes an added element and redoes it', () => {
    const { model, modelId } = setup();
    const element = thing(modelId);
    model.execute({ type: 'AddElement', element });

    model.undo();
    expect(model.getElement(element.id)).toBeUndefined();
    expect(model.canRedo).toBe(true);

    model.redo();
    expect(model.getElement(element.id)?.name).toBe('Order');
    expect(model.canUndo).toBe(true);
  });

  it('discards the redo history once a new command is executed', () => {
    const { model, modelId } = setup();
    model.execute({ type: 'AddElement', element: thing(modelId) });
    model.undo();

    model.execute({ type: 'AddElement', element: thing(modelId, { id: 'other' }) });

    expect(model.canRedo).toBe(false);
  });

  it('does not record a rejected command', () => {
    const { model, modelId } = setup();
    model.execute({ type: 'AddElement', element: thing(modelId) });
    expect(() => {
      model.execute({ type: 'AddElement', element: thing(modelId) });
    }).toThrow();

    model.undo();

    expect(model.canUndo).toBe(false);
  });

  it('ignores undo and redo with an empty history without notifying', () => {
    const { model } = setup();
    const listener = vi.fn();
    model.subscribe(listener);

    model.undo();
    model.redo();

    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies subscribers after undo and redo', () => {
    const { model, modelId } = setup();
    model.execute({ type: 'AddElement', element: thing(modelId) });
    const listener = vi.fn();
    model.subscribe(listener);

    model.undo();
    model.redo();

    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('revision', () => {
  it('is 0 before any edit', () => {
    expect(setup().model.revision).toBe(0);
  });

  it('returns to the saved revision after undoing a later edit', () => {
    const { model, modelId } = setup();
    model.execute({ type: 'AddElement', element: thing(modelId) });
    const saved = model.revision;

    model.execute({ type: 'SetName', id: thing(modelId).id, name: 'Purchase' });
    expect(model.revision).not.toBe(saved);

    model.undo();
    expect(model.revision).toBe(saved);
  });

  it('never reuses an old revision for an edit made after an undo', () => {
    const { model, modelId } = setup();
    model.execute({ type: 'AddElement', element: thing(modelId) });
    const first = model.revision;
    model.undo();

    model.execute({ type: 'AddElement', element: thing(modelId, { id: 'other' }) });

    expect(model.revision).not.toBe(first);
    expect(model.revision).not.toBe(0);
  });

  it('restores the revision of the edit that redo re-applies', () => {
    const { model, modelId } = setup();
    model.execute({ type: 'AddElement', element: thing(modelId) });
    const edited = model.revision;
    model.undo();

    model.redo();

    expect(model.revision).toBe(edited);
  });
});
