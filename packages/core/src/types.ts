import type { PropertyValue } from '@dm/metamodel';

export interface Element {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly ownerId: string | null;
  readonly properties: Readonly<Record<string, PropertyValue>>;
}

export type Command =
  | { readonly type: 'AddElement'; readonly element: Element }
  | { readonly type: 'RemoveElement'; readonly id: string }
  | { readonly type: 'RestoreElements'; readonly elements: readonly Element[] };
