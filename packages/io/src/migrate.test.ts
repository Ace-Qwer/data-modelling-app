import { describe, expect, it } from 'vitest';
import { migrate, type MigrationStep } from './migrate';
import { ProjectFileError, type ProjectFile } from './project-file';

const v1: ProjectFile = { format: 'dmproj', version: 1, savedWith: '0.1.0', elements: [] };

describe('migrate', () => {
  it('leaves a current file unchanged', () => {
    expect(migrate(v1)).toBe(v1);
  });

  it('applies upgrade steps in order until the target version', () => {
    const steps = new Map<number, MigrationStep>([
      [1, (f) => ({ ...f, version: 2, savedWith: `${f.savedWith}>2` })],
      [2, (f) => ({ ...f, version: 3, savedWith: `${f.savedWith}>3` })],
    ]);

    expect(migrate(v1, steps, 3)).toMatchObject({ version: 3, savedWith: '0.1.0>2>3' });
  });

  it('refuses a version it has no upgrade for', () => {
    expect(() => migrate(v1, new Map(), 2)).toThrow(ProjectFileError);
  });
});
