import { describe, expect, it } from 'vitest';
import { Registry } from './registry';
import type { ElementKind, Notation } from './types';

function kind(overrides: Partial<ElementKind> & Pick<ElementKind, 'id'>): ElementKind {
  return {
    label: 'Thing',
    icon: 'box',
    category: 'element',
    allowedOwners: ['core:Package'],
    properties: [],
    ...overrides,
  };
}

function notation(...kinds: ElementKind[]): Notation {
  return { id: 'test', label: 'Test', kinds };
}

describe('Registry', () => {
  it('always contains the core Project, Model and Package kinds', () => {
    const registry = Registry.create([]);

    expect(registry.kinds().map((k) => k.id)).toEqual([
      'core:Project',
      'core:Model',
      'core:Package',
    ]);
  });

  it('lists the kinds that may be placed under an owner kind', () => {
    const registry = Registry.create([
      notation(kind({ id: 'test:Thing', allowedOwners: ['core:Model', 'core:Package'] })),
    ]);

    expect(registry.kindsAllowedUnder('core:Model').map((k) => k.id)).toEqual([
      'core:Package',
      'test:Thing',
    ]);
    expect(registry.kindsAllowedUnder('core:Project').map((k) => k.id)).toEqual(['core:Model']);
    expect(registry.kindsAllowedUnder('test:Thing')).toEqual([]);
  });

  it('looks kinds up by id', () => {
    const registry = Registry.create([notation(kind({ id: 'test:Thing', label: 'Thing' }))]);

    expect(registry.kind('test:Thing')?.label).toBe('Thing');
    expect(registry.kind('test:Missing')).toBeUndefined();
  });

  it('lets a notation reference kinds of another notation registered with it', () => {
    const shapes: Notation = { id: 'shapes', label: 'Shapes', kinds: [kind({ id: 'shapes:Box' })] };
    const labels = notation(kind({ id: 'test:Label', allowedOwners: ['shapes:Box'] }));

    expect(() => Registry.create([labels, shapes])).not.toThrow();
  });

  it.each<[string, Notation[], RegExp]>([
    [
      'a kind registered twice',
      [notation(kind({ id: 'test:Thing' }), kind({ id: 'test:Thing' }))],
      /test:Thing is registered twice/,
    ],
    [
      'a kind that re-registers a core kind',
      [{ id: 'core', label: 'Core again', kinds: [kind({ id: 'core:Package' })] }],
      /core:Package is registered twice/,
    ],
    [
      'a kind id without its notation prefix',
      [notation(kind({ id: 'other:Thing' }))],
      /other:Thing must be prefixed with "test:"/,
    ],
    [
      'an unknown allowed owner',
      [notation(kind({ id: 'test:Thing', allowedOwners: ['test:Nowhere'] }))],
      /test:Thing allows unknown owner test:Nowhere/,
    ],
    [
      'a property key used twice',
      [
        notation(
          kind({
            id: 'test:Thing',
            properties: [
              { key: 'flag', label: 'Flag', type: 'boolean', default: false },
              { key: 'flag', label: 'Flag again', type: 'boolean', default: true },
            ],
          }),
        ),
      ],
      /test:Thing defines property flag twice/,
    ],
    [
      'an enum default outside its options',
      [
        notation(
          kind({
            id: 'test:Thing',
            properties: [
              { key: 'size', label: 'Size', type: 'enum', options: ['s', 'm'], default: 'xl' },
            ],
          }),
        ),
      ],
      /test:Thing\.size default "xl" is not one of its options/,
    ],
  ])('rejects %s', (_, notations, error) => {
    expect(() => Registry.create(notations)).toThrow(error);
  });
});
