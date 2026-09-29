import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Model } from './model';
import { setup } from './testing';
import type { Command, Element } from './types';

type Intent =
  | { op: 'add'; owner: number; kind: 'core:Package' | 'test:Thing'; name: string }
  | { op: 'remove'; target: number }
  | { op: 'rename'; target: number; name: string }
  | { op: 'flag'; target: number; value: boolean };

const name = fc.string({ minLength: 1 }).filter((s) => s.trim() !== '');
const intents = fc.array(
  fc.oneof(
    fc.record({
      op: fc.constant('add' as const),
      owner: fc.nat(),
      kind: fc.constantFrom('core:Package' as const, 'test:Thing' as const),
      name,
    }),
    fc.record({ op: fc.constant('remove' as const), target: fc.nat() }),
    fc.record({ op: fc.constant('rename' as const), target: fc.nat(), name }),
    fc.record({ op: fc.constant('flag' as const), target: fc.nat(), value: fc.boolean() }),
  ),
  { maxLength: 30 },
);

function sequentialIds(prefix: string): () => string {
  let next = 0;
  return () => `${prefix}-${String(next++).padStart(4, '0')}`;
}

function toCommand(intent: Intent, pick: (n: number) => string, newId: () => string): Command {
  switch (intent.op) {
    case 'add':
      return {
        type: 'AddElement',
        element: {
          id: newId(),
          kind: intent.kind,
          name: intent.name,
          ownerId: pick(intent.owner),
          properties: {},
        },
      };
    case 'remove':
      return { type: 'RemoveElement', id: pick(intent.target) };
    case 'rename':
      return { type: 'SetName', id: pick(intent.target), name: intent.name };
    case 'flag':
      return { type: 'SetProperty', id: pick(intent.target), key: 'flag', value: intent.value };
  }
}

function run(model: Model, plan: readonly Intent[]): Command[] {
  const newId = sequentialIds('el');
  const executed: Command[] = [];
  for (const intent of plan) {
    const ids = model
      .elements()
      .map((e) => e.id)
      .sort();
    const pick = (n: number) => ids[n % ids.length] ?? '';
    const command = toCommand(intent, pick, newId);
    try {
      model.execute(command);
      executed.push(command);
    } catch {
      // Random intents are often invalid for the current state; the model rejects them unchanged.
    }
  }
  return executed;
}

const snapshot = (model: Model): Element[] =>
  [...model.elements()].sort((a, b) => a.id.localeCompare(b.id));

describe('Model properties', () => {
  it('returns to its initial state after undoing every command', () => {
    fc.assert(
      fc.property(intents, (plan) => {
        const { model } = setup(sequentialIds('base'));
        const initial = snapshot(model);

        const executed = run(model, plan);
        executed.forEach(() => {
          model.undo();
        });

        expect(snapshot(model)).toEqual(initial);
        expect(model.canUndo).toBe(false);
      }),
    );
  });

  it('reaches the same state again by redoing everything it undid', () => {
    fc.assert(
      fc.property(intents, (plan) => {
        const { model } = setup(sequentialIds('base'));
        const executed = run(model, plan);
        const final = snapshot(model);

        executed.forEach(() => {
          model.undo();
        });
        executed.forEach(() => {
          model.redo();
        });

        expect(snapshot(model)).toEqual(final);
      }),
    );
  });

  // Collaboration peers will receive commands as JSON, so replaying them must reproduce the model.
  it('reaches the same state when replaying JSON round-tripped commands', () => {
    fc.assert(
      fc.property(intents, (plan) => {
        const { model: original } = setup(sequentialIds('base'));
        const executed = run(original, plan);
        const wire = JSON.parse(JSON.stringify(executed)) as Command[];

        const { model: replica } = setup(sequentialIds('base'));
        for (const command of wire) replica.execute(command);

        expect(snapshot(replica)).toEqual(snapshot(original));
      }),
    );
  });
});
