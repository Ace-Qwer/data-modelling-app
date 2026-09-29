import { describe, expect, it } from 'vitest';
import { setup, thing } from './testing';
import type { Element } from './types';

const byId = (a: Element, b: Element) => a.id.localeCompare(b.id);

function withPackage() {
  const { model, modelId } = setup();
  const pkg: Element = {
    id: 'pkg',
    kind: 'core:Package',
    name: 'Ordering',
    ownerId: modelId,
    properties: {},
  };
  const inner = thing('pkg', { id: 'inner' });
  model.execute({ type: 'AddElement', element: pkg });
  model.execute({ type: 'AddElement', element: inner });
  return { model, modelId };
}

describe('RemoveElement', () => {
  it('removes the element together with everything it owns', () => {
    const { model } = withPackage();

    model.execute({ type: 'RemoveElement', id: 'pkg' });

    expect(model.getElement('pkg')).toBeUndefined();
    expect(model.getElement('inner')).toBeUndefined();
  });

  it('is undone by restoring the whole subtree exactly', () => {
    const { model } = withPackage();
    const before = [...model.elements()].sort(byId);

    model.execute({ type: 'RemoveElement', id: 'pkg' });
    model.undo();

    expect([...model.elements()].sort(byId)).toEqual(before);
  });

  it('refuses to remove the project root', () => {
    const { model } = setup();

    expect(() => {
      model.execute({ type: 'RemoveElement', id: model.root.id });
    }).toThrow(/project root cannot be removed/);
    expect(model.getElement(model.root.id)).toBeDefined();
  });

  it('refuses to remove an element that does not exist', () => {
    const { model } = setup();

    expect(() => {
      model.execute({ type: 'RemoveElement', id: 'ghost' });
    }).toThrow(/does not exist/);
  });
});

describe('RestoreElements', () => {
  it('rejects an empty batch', () => {
    const { model } = setup();

    expect(() => {
      model.execute({ type: 'RestoreElements', elements: [] });
    }).toThrow(/at least one element/);
  });

  it('rejects an element whose owner lies outside the restored subtree, changing nothing', () => {
    const { model, modelId } = setup();
    const before = model.elements();

    expect(() => {
      model.execute({
        type: 'RestoreElements',
        elements: [thing(modelId, { id: 'a' }), thing(modelId, { id: 'b' })],
      });
    }).toThrow(/outside the restored subtree/);
    expect(model.elements()).toEqual(before);
  });

  it('rolls back the elements it already restored when a later one is invalid', () => {
    const { model, modelId } = withPackage();
    const before = model.elements();
    const outer: Element = {
      id: 'outer',
      kind: 'core:Package',
      name: 'Outer',
      ownerId: modelId,
      properties: {},
    };

    expect(() => {
      model.execute({
        type: 'RestoreElements',
        elements: [outer, thing('outer', { id: 'inner' })],
      });
    }).toThrow(/already exists/);
    expect(model.elements()).toEqual(before);
  });
});
