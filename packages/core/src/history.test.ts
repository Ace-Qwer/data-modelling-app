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
