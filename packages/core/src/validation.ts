import type { ElementKind, PropertyDefinition, PropertyValue } from '@dm/metamodel';

export function assertName(name: string): void {
  if (name.trim() === '') throw new Error('Name must not be empty');
}

export function defaultsOf(kind: ElementKind): Record<string, PropertyValue> {
  return Object.fromEntries(kind.properties.map((p) => [p.key, p.default]));
}

export function assertPropertyValue(
  kind: ElementKind,
  key: string,
  value: PropertyValue,
): PropertyDefinition {
  const definition = kind.properties.find((p) => p.key === key);
  if (!definition) throw new Error(`${kind.id} has no property ${key}`);
  if (!isValid(definition, value)) {
    throw new Error(`Invalid value for ${kind.id}.${key}: ${JSON.stringify(value)}`);
  }
  return definition;
}

function isValid(definition: PropertyDefinition, value: PropertyValue): boolean {
  switch (definition.type) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'enum':
      return typeof value === 'string' && definition.options.includes(value);
    case 'string':
    case 'text':
      return typeof value === 'string';
  }
}
