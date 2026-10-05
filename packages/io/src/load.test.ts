import { Model } from '@dm/core';
import { Registry } from '@dm/metamodel';
import { umlNotation } from '@dm/notation-uml';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { loadProject } from './load';
import { serializeProject } from './serialize';

const registry = Registry.create([umlNotation]);

type Edit =
  | { op: 'add'; owner: number; kind: 'core:Package' | 'uml:Class'; name: string }
  | { op: 'rename'; target: number; name: string }
  | { op: 'abstract'; target: number; value: boolean };

const name = fc.string({ minLength: 1 }).filter((s) => s.trim() !== '');
const edits = fc.array(
  fc.oneof(
    fc.record({
      op: fc.constant('add' as const),
      owner: fc.nat(),
      kind: fc.constantFrom('core:Package' as const, 'uml:Class' as const),
      name,
    }),
    fc.record({ op: fc.constant('rename' as const), target: fc.nat(), name }),
    fc.record({ op: fc.constant('abstract' as const), target: fc.nat(), value: fc.boolean() }),
  ),
  { maxLength: 25 },
);

function build(plan: readonly Edit[]): Model {
  const model = new Model(registry);
  let next = 0;
  for (const edit of plan) {
    const ids = model
      .elements()
      .map((e) => e.id)
      .sort();
    const pick = (n: number) => ids[n % ids.length] ?? '';
    try {
      if (edit.op === 'add') {
        model.execute({
          type: 'AddElement',
          element: {
            id: `e${String(next++)}`,
            kind: edit.kind,
            name: edit.name,
            ownerId: pick(edit.owner),
            properties: {},
          },
        });
      } else if (edit.op === 'rename') {
        model.execute({ type: 'SetName', id: pick(edit.target), name: edit.name });
      } else {
        model.execute({
          type: 'SetProperty',
          id: pick(edit.target),
          key: 'isAbstract',
          value: edit.value,
        });
      }
    } catch {
      // Random edits are often invalid for the current state; the model rejects them unchanged.
    }
  }
  return model;
}

describe('loadProject', () => {
  it('loads what was saved back into an identical model', () => {
    fc.assert(
      fc.property(edits, (plan) => {
        const text = serializeProject(build(plan), '0.1.0');

        expect(serializeProject(loadProject(text, registry), '0.1.0')).toBe(text);
      }),
    );
  });
});
