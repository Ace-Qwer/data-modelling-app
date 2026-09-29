import { describe, expect, it, vi } from 'vitest';
import { setup, thing } from './testing';
import type { Element } from './types';

describe('a new Model', () => {
  it('has an Untitled Project root that owns one Model', () => {
    const { model } = setup();

    expect(model.root).toMatchObject({
      kind: 'core:Project',
      name: 'Untitled Project',
      ownerId: null,
    });
    expect(model.children(model.root.id)).toEqual([
      expect.objectContaining({ kind: 'core:Model', name: 'Model', ownerId: model.root.id }),
    ]);
  });

  it('uses the injected id factory for its root and Model', () => {
    const ids = ['root-id', 'model-id'];
    const { model, modelId } = setup(() => ids.shift() ?? 'unexpected');

    expect(model.root.id).toBe('root-id');
    expect(modelId).toBe('model-id');
  });
});

describe('AddElement', () => {
  it('adds the element under its owner', () => {
    const { model, modelId } = setup();

    model.execute({ type: 'AddElement', element: thing(modelId) });

    expect(model.children(modelId).map((e) => e.name)).toEqual(['Order']);
  });

  it('fills in defaults for properties the element omits', () => {
    const { model, modelId } = setup();
    const element = thing(modelId, { properties: { flag: true } });

    model.execute({ type: 'AddElement', element });

    expect(model.getElement(element.id)?.properties).toEqual({
      flag: true,
      size: 'small',
      note: '',
    });
  });

  it('rejects an id that is already in use and keeps the original', () => {
    const { model, modelId } = setup();
    model.execute({ type: 'AddElement', element: thing(modelId) });

    expect(() => {
      model.execute({ type: 'AddElement', element: thing(modelId, { name: 'Clash' }) });
    }).toThrow(/already exists/);
    expect(model.getElement(thing(modelId).id)?.name).toBe('Order');
  });

  it.each<[string, (modelId: string, rootId: string) => Element, RegExp]>([
    ['an unknown kind', (m) => thing(m, { kind: 'test:Nope' }), /Unknown kind test:Nope/],
    ['a missing owner', () => thing('01J9Z8Q4X7M2N5P6R8S0T1V3ZZ'), /does not exist/],
    ['an owner that may not own it', (_m, root) => thing(root), /cannot be owned by core:Project/],
    ['no owner', () => thing('', { ownerId: null }), /Only the project root may have no owner/],
    ['a name of only spaces', (m) => thing(m, { name: '   ' }), /Name must not be empty/],
    [
      'an undefined property',
      (m) => thing(m, { properties: { colour: 'red' } }),
      /has no property colour/,
    ],
    [
      'a wrongly typed property',
      (m) => thing(m, { properties: { flag: 'yes' } }),
      /Invalid value for test:Thing\.flag/,
    ],
    [
      'an enum value outside its options',
      (m) => thing(m, { properties: { size: 'huge' } }),
      /Invalid value for test:Thing\.size/,
    ],
  ])('rejects an element with %s and leaves the model unchanged', (_, build, error) => {
    const { model, modelId } = setup();
    const before = model.elements();

    expect(() => {
      model.execute({ type: 'AddElement', element: build(modelId, model.root.id) });
    }).toThrow(error);
    expect(model.elements()).toEqual(before);
  });
});

describe('queries', () => {
  it('lists every element, including the root and Model', () => {
    const { model, modelId } = setup();
    model.execute({ type: 'AddElement', element: thing(modelId) });

    expect(model.elements().map((e) => e.name)).toEqual(
      expect.arrayContaining(['Untitled Project', 'Model', 'Order']),
    );
    expect(model.elements()).toHaveLength(3);
  });

  it('returns no children for an element that owns nothing', () => {
    const { model, modelId } = setup();
    model.execute({ type: 'AddElement', element: thing(modelId) });

    expect(model.children(thing(modelId).id)).toEqual([]);
  });
});

describe('subscribers', () => {
  it('are notified after each executed command and see a new version', () => {
    const { model, modelId } = setup();
    const listener = vi.fn();
    const versionBefore = model.version;
    model.subscribe(listener);

    model.execute({ type: 'AddElement', element: thing(modelId) });

    expect(listener).toHaveBeenCalledOnce();
    expect(model.version).not.toBe(versionBefore);
  });

  it('are not notified when a command is rejected', () => {
    const { model, modelId } = setup();
    const listener = vi.fn();
    model.subscribe(listener);

    expect(() => {
      model.execute({ type: 'AddElement', element: thing(modelId, { name: '' }) });
    }).toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('are not notified after unsubscribing', () => {
    const { model, modelId } = setup();
    const listener = vi.fn();
    const unsubscribe = model.subscribe(listener);

    unsubscribe();
    model.execute({ type: 'AddElement', element: thing(modelId) });

    expect(listener).not.toHaveBeenCalled();
  });
});
