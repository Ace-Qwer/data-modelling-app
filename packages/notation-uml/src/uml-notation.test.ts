import { Registry } from '@dm/metamodel';
import { describe, expect, it } from 'vitest';
import { umlNotation } from './uml-notation';

describe('UML notation', () => {
  it('passes registry validation together with the core notation', () => {
    expect(() => Registry.create([umlNotation])).not.toThrow();
  });

  it.each(['core:Model', 'core:Package'])(
    'lets classes and class diagrams live under %s',
    (owner) => {
      const registry = Registry.create([umlNotation]);

      expect(registry.kindsAllowedUnder(owner).map((k) => k.id)).toEqual(
        expect.arrayContaining(['uml:Class', 'uml:ClassDiagram']),
      );
    },
  );

  it('marks the class diagram as a diagram so the shell can open it', () => {
    const registry = Registry.create([umlNotation]);

    expect(registry.kind('uml:ClassDiagram')?.category).toBe('diagram');
  });

  it('does not let anything be placed inside a class yet', () => {
    const registry = Registry.create([umlNotation]);

    expect(registry.kindsAllowedUnder('uml:Class')).toEqual([]);
  });
});
