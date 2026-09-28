import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Model, type Command } from './model';

const element = fc.record({
  id: fc.ulid(),
  kind: fc.constantFrom('uml:Class', 'uml:Interface', 'er:Entity'),
  name: fc.string(),
});

const addCommands = fc
  .uniqueArray(element, { selector: (e) => e.id })
  .map((elements) => elements.map((e): Command => ({ type: 'AddElement', element: e })));

function replay(commands: readonly Command[]): Model {
  const model = new Model();
  for (const command of commands) model.execute(command);
  return model;
}

describe('Model properties', () => {
  // Collaboration peers will receive commands over the wire, so replaying
  // serialised commands must reproduce the model exactly.
  it('reaches the same state when replaying JSON round-tripped commands', () => {
    fc.assert(
      fc.property(addCommands, (commands) => {
        const wire = JSON.parse(JSON.stringify(commands)) as Command[];

        expect(replay(wire).elements()).toEqual(replay(commands).elements());
      }),
    );
  });

  it('returns to an empty model after undoing every command', () => {
    fc.assert(
      fc.property(addCommands, (commands) => {
        const model = replay(commands);

        commands.forEach(() => {
          model.undo();
        });

        expect(model.elements()).toEqual([]);
      }),
    );
  });
});
