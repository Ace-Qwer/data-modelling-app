import { Model } from '@dm/core';
import { Registry } from '@dm/metamodel';
import { umlNotation } from '@dm/notation-uml';
import { describe, expect, it } from 'vitest';
import { serializeProject } from './serialize';

const registry = Registry.create([umlNotation]);

function sample() {
  const ids = ['r', 'm'];
  const model = new Model(registry, () => ids.shift() ?? 'x');
  model.execute({
    type: 'AddElement',
    element: { id: 'p2', kind: 'core:Package', name: 'Billing', ownerId: 'm', properties: {} },
  });
  model.execute({
    type: 'AddElement',
    element: { id: 'p1', kind: 'core:Package', name: 'Ordering', ownerId: 'm', properties: {} },
  });
  model.execute({
    type: 'AddElement',
    element: { id: 'c1', kind: 'uml:Class', name: 'Order', ownerId: 'p1', properties: {} },
  });
  return model;
}

describe('serializeProject', () => {
  it('writes a versioned dmproj document', () => {
    const file = JSON.parse(serializeProject(sample(), '0.1.0')) as Record<string, unknown>;

    expect(file).toMatchObject({ format: 'dmproj', version: 1, savedWith: '0.1.0' });
  });

  it('lists elements parents first with siblings ordered by id', () => {
    const file = JSON.parse(serializeProject(sample(), '0.1.0')) as { elements: { id: string }[] };

    expect(file.elements.map((e) => e.id)).toEqual(['r', 'm', 'p1', 'p2', 'c1']);
  });

  it('is pretty-printed with a trailing newline so files diff cleanly', () => {
    const text = serializeProject(sample(), '0.1.0');

    expect(text.startsWith('{\n  "format": "dmproj"')).toBe(true);
    expect(text.endsWith('}\n')).toBe(true);
  });
});
