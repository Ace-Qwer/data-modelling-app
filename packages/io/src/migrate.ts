import { CURRENT_VERSION, ProjectFileError, type ProjectFile } from './project-file';

export type MigrationStep = (file: ProjectFile) => ProjectFile;

// Keyed by the version each step upgrades from; saving diagram layouts (sub-project C) adds step 1.
export const migrations: ReadonlyMap<number, MigrationStep> = new Map();

export function migrate(
  file: ProjectFile,
  steps: ReadonlyMap<number, MigrationStep> = migrations,
  target: number = CURRENT_VERSION,
): ProjectFile {
  let current = file;
  while (current.version < target) {
    const step = steps.get(current.version);
    if (!step) {
      throw new ProjectFileError(
        `This project uses file format version ${String(current.version)}, which this app cannot upgrade.`,
      );
    }
    current = step(current);
  }
  return current;
}
