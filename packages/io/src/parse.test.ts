import { describe, expect, it } from 'vitest';
import { parseProject } from './parse';
import { ProjectFileError } from './project-file';

const root = { id: 'r', kind: 'core:Project', name: 'P', ownerId: null, properties: {} };

function text(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: 'dmproj',
    version: 1,
    savedWith: '0.1.0',
    elements: [root],
    ...overrides,
  });
}

describe('parseProject', () => {
  it('reads a valid file', () => {
    expect(parseProject(text())).toEqual({
      format: 'dmproj',
      version: 1,
      savedWith: '0.1.0',
      elements: [root],
    });
  });

  it.each<[string, string, string]>([
    ['text that is not JSON', 'hello', 'This file is not a Schemata project.'],
    [
      'another JSON document',
      JSON.stringify({ name: 'package.json' }),
      'This file is not a Schemata project.',
    ],
    ['a missing version', text({ version: undefined }), 'The project file is damaged.'],
    ['a fractional version', text({ version: 1.5 }), 'The project file is damaged.'],
    [
      'a newer version',
      text({ version: 99 }),
      'This project was saved by a newer version of Schemata.',
    ],
    ['elements that are not a list', text({ elements: {} }), 'The project file is damaged.'],
    [
      'an element without a kind',
      text({ elements: [{ ...root, kind: undefined }] }),
      'The project file is damaged.',
    ],
    [
      'a non-string owner',
      text({ elements: [{ ...root, ownerId: 7 }] }),
      'The project file is damaged.',
    ],
    [
      'a numeric property',
      text({ elements: [{ ...root, properties: { size: 3 } }] }),
      'The project file is damaged.',
    ],
  ])('rejects %s', (_, input, message) => {
    expect(() => parseProject(input)).toThrow(ProjectFileError);
    expect(() => parseProject(input)).toThrow(message);
  });
});
