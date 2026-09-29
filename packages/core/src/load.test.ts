import { Registry } from '@dm/metamodel';
import { describe, expect, it } from 'vitest';
import { ModelLoadError } from './load-error';
import { Model } from './model';
import { setup, testNotation, thing } from './testing';
import type { Element } from './types';

const registry = Registry.create([testNotation]);
const byId = (a: Element, b: Element) => a.id.localeCompare(b.id);

function savedElements(): { elements: Element[]; rootId: string; modelId: string } {
  const { model, modelId } = setup();
  model.execute({ type: 'AddElement', element: thing(modelId, { properties: { flag: true } }) });
  return { elements: [...model.elements()], rootId: model.root.id, modelId };
}

describe('Model.load', () => {
  it('rebuilds an identical model with an empty history', () => {
    const { elements, rootId } = savedElements();

    const loaded = Model.load(registry, elements);

    expect([...loaded.elements()].sort(byId)).toEqual([...elements].sort(byId));
    expect(loaded.root.id).toBe(rootId);
    expect(loaded.canUndo).toBe(false);
    expect(loaded.revision).toBe(0);
  });

  it('accepts children listed before their parents', () => {
    const { elements } = savedElements();

    const loaded = Model.load(registry, [...elements].reverse());

    expect(loaded.elements()).toHaveLength(elements.length);
  });

  it('can be edited and undone like any model', () => {
    const { elements, modelId } = savedElements();
    const loaded = Model.load(registry, elements);

    loaded.execute({ type: 'SetName', id: modelId, name: 'Renamed' });
    loaded.undo();

    expect(loaded.getElement(modelId)?.name).toBe('Model');
  });

  it.each<[string, (s: ReturnType<typeof savedElements>) => Element[], RegExp]>([
    [
      'no project root',
      (s) => s.elements.filter((e) => e.id !== s.rootId),
      /exactly one project root/,
    ],
    [
      'two project roots',
      (s) => [
        ...s.elements,
        { id: 'root-2', kind: 'core:Project', name: 'Second', ownerId: null, properties: {} },
      ],
      /exactly one project root/,
    ],
    [
      'a root of the wrong kind',
      (s) => s.elements.map((e) => (e.id === s.rootId ? { ...e, kind: 'core:Package' } : e)),
      /exactly one project root/,
    ],
    [
      'unknown element kinds',
      (s) => [
        ...s.elements,
        thing(s.modelId, { id: 'a', kind: 'y:Bar' }),
        thing(s.modelId, { id: 'b', kind: 'x:Foo' }),
      ],
      /element kinds this app doesn't know: x:Foo, y:Bar/,
    ],
    [
      'an orphan',
      (s) => [...s.elements, thing('ghost', { id: 'orphan' })],
      /belongs to an element that doesn't exist/,
    ],
    [
      'an invalid property',
      (s) => [...s.elements, thing(s.modelId, { id: 'bad', properties: { flag: 'yes' } })],
      /damaged: Invalid value/,
    ],
    ['a duplicate id', (s) => [...s.elements, thing(s.modelId)], /damaged: .*already exists/],
  ])('rejects %s', (_, corrupt, message) => {
    const broken = corrupt(savedElements());

    expect(() => Model.load(registry, broken)).toThrow(ModelLoadError);
    expect(() => Model.load(registry, broken)).toThrow(message);
  });
});
