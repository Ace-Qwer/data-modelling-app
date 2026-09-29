import { describe, expect, it, vi } from 'vitest';
import { allActions } from '../actions';
import { addElement, createActionContext } from '../testing/fixture';
import { runMenuItem } from './menu-model';
import { createShortcutLog } from './shortcut-log';
import { handleNativeActivation, handleShortcutKey } from './shortcut-routing';

function setup() {
  const fixture = createActionContext();
  addElement(fixture.model, 'core:Package', fixture.modelId, 'First');
  addElement(fixture.model, 'core:Package', fixture.modelId, 'Second');
  const log = createShortcutLog();
  const actions = allActions(fixture.registry);
  const packages = () => fixture.model.children(fixture.modelId).length;
  const native = (id: string, now: number) => {
    handleNativeActivation(
      id,
      log,
      (actionId) => {
        runMenuItem(actionId, fixture.ctx);
      },
      now,
    );
  };
  const key = (k: string, mods: { ctrlKey?: boolean }, target: EventTarget | null, now: number) => {
    const preventDefault = vi.fn<() => void>();
    handleShortcutKey(
      {
        key: k,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        ...mods,
        target,
        preventDefault,
      },
      actions,
      fixture.ctx,
      log,
      false,
      now,
    );
    return preventDefault;
  };
  return { ...fixture, packages, native, key };
}

describe('shortcut routing', () => {
  it('undoes once when the keypress arrives before the native menu event', () => {
    const { packages, native, key } = setup();

    key('z', { ctrlKey: true }, document.body, 1000);
    native('edit.undo', 1040);

    expect(packages()).toBe(1);
  });

  it('undoes once when the native menu event arrives before the keypress', () => {
    const { packages, native, key } = setup();

    native('edit.undo', 1000);
    const preventDefault = key('z', { ctrlKey: true }, document.body, 1040);

    expect(packages()).toBe(1);
    expect(preventDefault).toHaveBeenCalled();
  });

  it('treats presses further apart than the duplicate window as separate', () => {
    const { packages, native, key } = setup();

    key('z', { ctrlKey: true }, document.body, 1000);
    native('edit.undo', 1400);

    expect(packages()).toBe(0);
  });

  it('runs a native activation with no keypress, such as a mouse click on the menu', () => {
    const { packages, native } = setup();

    native('edit.undo', 1000);

    expect(packages()).toBe(1);
  });

  it('undoes the text of a focused field itself, once, without touching the model', () => {
    const { packages, key, textCommand } = setup();
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    try {
      const preventDefault = key('z', { ctrlKey: true }, input, 1000);
      expect(preventDefault).toHaveBeenCalled();
    } finally {
      input.remove();
    }

    expect(textCommand.mock.calls).toEqual([['undo']]);
    expect(packages()).toBe(2);
  });

  it('leaves Delete to a focused text field', () => {
    const { packages, key, ui, model, modelId } = setup();
    const [first] = model.children(modelId);
    ui.getState().select(first?.id ?? null);
    const input = document.createElement('input');

    const preventDefault = key('Delete', {}, input, 1000);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(packages()).toBe(2);
  });
});
