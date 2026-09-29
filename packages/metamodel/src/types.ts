export type PropertyValue = string | boolean;

interface PropertyBase {
  readonly key: string;
  readonly label: string;
}

export type PropertyDefinition =
  | (PropertyBase & { readonly type: 'string' | 'text'; readonly default: string })
  | (PropertyBase & { readonly type: 'boolean'; readonly default: boolean })
  | (PropertyBase & {
      readonly type: 'enum';
      readonly options: readonly string[];
      readonly default: string;
    });

export type KindCategory = 'package' | 'diagram' | 'element';

export interface ElementKind {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly category: KindCategory;
  readonly allowedOwners: readonly string[];
  readonly properties: readonly PropertyDefinition[];
  readonly tools?: readonly string[];
}

export interface Notation {
  readonly id: string;
  readonly label: string;
  readonly kinds: readonly ElementKind[];
}
