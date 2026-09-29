import type { PropertyValue } from '@dm/metamodel';
import { describe, expect, it } from 'vitest';
import { setup, thing } from './testing';

function withThing() {
  const { model, modelId } = setup();
  const element = thing(modelId);
  model.execute({ type: 'AddElement', element });
  return { model, id: element.id };
}

describe('SetName', () => {
  it('renames the element and is undone back to the previous name', () => {
    const { model, id } = withThing();

    model.execute({ type: 'SetName', id, name: 'Purchase' });
    expect(model.getElement(id)?.name).toBe('Purchase');

    model.undo();
    expect(model.getElement(id)?.name).toBe('Order');
  });

  it.each(['', '   '])('rejects the blank name %j', (name) => {
    const { model, id } = withThing();

    expect(() => {
      model.execute({ type: 'SetName', id, name });
    }).toThrow(/Name must not be empty/);
    expect(model.getElement(id)?.name).toBe('Order');
  });

  it('rejects renaming an element that does not exist', () => {
    const { model } = withThing();

    expect(() => {
      model.execute({ type: 'SetName', id: 'ghost', name: 'X' });
    }).toThrow(/does not exist/);
  });
});

describe('SetProperty', () => {
  it('sets the value and is undone back to the previous value', () => {
    const { model, id } = withThing();

    model.execute({ type: 'SetProperty', id, key: 'size', value: 'large' });
    expect(model.getElement(id)?.properties.size).toBe('large');

    model.undo();
    expect(model.getElement(id)?.properties.size).toBe('small');
  });

  it.each<[string, string, PropertyValue, RegExp]>([
    ['an undefined key', 'colour', 'red', /has no property colour/],
    ['a wrongly typed value', 'flag', 'yes', /Invalid value for test:Thing\.flag/],
    ['an enum value outside its options', 'size', 'huge', /Invalid value for test:Thing\.size/],
  ])('rejects %s and keeps the old value', (_, key, value, error) => {
    const { model, id } = withThing();
    const before = model.getElement(id);

    expect(() => {
      model.execute({ type: 'SetProperty', id, key, value });
    }).toThrow(error);
    expect(model.getElement(id)).toEqual(before);
  });

  it('rejects setting a property on an element that does not exist', () => {
    const { model } = withThing();

    expect(() => {
      model.execute({ type: 'SetProperty', id: 'ghost', key: 'flag', value: true });
    }).toThrow(/does not exist/);
  });
});
