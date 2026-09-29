import { Registry, type Notation } from '@dm/metamodel';
import { Model } from './model';
import type { Element } from './types';

export const testNotation: Notation = {
  id: 'test',
  label: 'Test',
  kinds: [
    {
      id: 'test:Thing',
      label: 'Thing',
      icon: 'box',
      category: 'element',
      allowedOwners: ['core:Model', 'core:Package'],
      properties: [
        { key: 'flag', label: 'Flag', type: 'boolean', default: false },
        { key: 'size', label: 'Size', type: 'enum', options: ['small', 'large'], default: 'small' },
        { key: 'note', label: 'Note', type: 'text', default: '' },
      ],
    },
  ],
};

export function setup(createId?: () => string): { model: Model; modelId: string } {
  const registry = Registry.create([testNotation]);
  const model = createId ? new Model(registry, createId) : new Model(registry);
  const [modelElement] = model.children(model.root.id);
  if (!modelElement) throw new Error('A new model always contains a Model element');
  return { model, modelId: modelElement.id };
}

export function thing(ownerId: string, overrides: Partial<Element> = {}): Element {
  return {
    id: '01J9Z8Q4X7M2N5P6R8S0T1V3W4',
    kind: 'test:Thing',
    name: 'Order',
    ownerId,
    properties: {},
    ...overrides,
  };
}
