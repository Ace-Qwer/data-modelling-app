import { Model } from '@dm/core';
import { Registry, type Notation, type PropertyValue } from '@dm/metamodel';
import { umlNotation } from '@dm/notation-uml';
import { ulid } from 'ulid';

export function createFixture(notations: readonly Notation[] = [umlNotation]) {
  const registry = Registry.create(notations);
  const model = new Model(registry);
  const [modelElement] = model.children(model.root.id);
  if (!modelElement) throw new Error('A new model always contains a Model element');
  return { registry, model, modelId: modelElement.id };
}

export function addElement(
  model: Model,
  kind: string,
  ownerId: string,
  name: string,
  properties: Readonly<Record<string, PropertyValue>> = {},
): string {
  const id = ulid();
  model.execute({ type: 'AddElement', element: { id, kind, name, ownerId, properties } });
  return id;
}
