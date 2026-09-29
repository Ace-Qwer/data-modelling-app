import type { PropertyValue } from '@dm/metamodel';

export interface Element {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly ownerId: string | null;
  readonly properties: Readonly<Record<string, PropertyValue>>;
}

export interface AddElement {
  readonly type: 'AddElement';
  readonly element: Element;
}

export type Command = AddElement;
