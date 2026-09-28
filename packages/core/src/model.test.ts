import { describe, expect, it } from 'vitest';
import { Model } from './model';

const orderClass = { id: '01J9Z8Q4X7M2N5P6R8S0T1V3W4', kind: 'uml:Class', name: 'Order' };
const customerClass = { id: '01J9Z8Q4X7M2N5P6R8S0T1V3W5', kind: 'uml:Class', name: 'Customer' };

describe('Model', () => {
  it('stores an element added by an AddElement command', () => {
    const model = new Model();

    model.execute({ type: 'AddElement', element: orderClass });

    expect(model.getElement(orderClass.id)).toEqual(orderClass);
  });

  it('lists every element it contains', () => {
    const model = new Model();
    model.execute({ type: 'AddElement', element: orderClass });
    model.execute({ type: 'AddElement', element: customerClass });

    expect(model.elements()).toEqual(expect.arrayContaining([orderClass, customerClass]));
    expect(model.elements()).toHaveLength(2);
  });

  describe('when the id is already in use', () => {
    const clash = { ...customerClass, id: orderClass.id };

    it('rejects the AddElement and keeps the original element', () => {
      const model = new Model();
      model.execute({ type: 'AddElement', element: orderClass });

      expect(() => {
        model.execute({ type: 'AddElement', element: clash });
      }).toThrow(`Element ${orderClass.id} already exists`);
      expect(model.getElement(orderClass.id)).toEqual(orderClass);
    });

    it('does not record the rejected command in the undo history', () => {
      const model = new Model();
      model.execute({ type: 'AddElement', element: orderClass });
      expect(() => {
        model.execute({ type: 'AddElement', element: clash });
      }).toThrow();

      model.undo();

      expect(model.getElement(orderClass.id)).toBeUndefined();
    });
  });

  it('removes the added element again on undo', () => {
    const model = new Model();
    model.execute({ type: 'AddElement', element: orderClass });

    model.undo();

    expect(model.getElement(orderClass.id)).toBeUndefined();
  });

  it('restores an undone element on redo', () => {
    const model = new Model();
    model.execute({ type: 'AddElement', element: orderClass });
    model.undo();

    model.redo();

    expect(model.getElement(orderClass.id)).toEqual(orderClass);
  });

  it('ignores undo and redo when there is nothing to undo or redo', () => {
    const model = new Model();

    expect(() => {
      model.undo();
      model.redo();
    }).not.toThrow();
  });

  it('discards the redo history once a new command is executed', () => {
    const model = new Model();
    model.execute({ type: 'AddElement', element: orderClass });
    model.undo();
    model.execute({ type: 'AddElement', element: customerClass });

    model.redo();

    expect(model.getElement(orderClass.id)).toBeUndefined();
  });
});
