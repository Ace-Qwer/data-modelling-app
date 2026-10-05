import type { Element } from '@dm/core';

export const CURRENT_VERSION = 1;

export interface ProjectFile {
  readonly format: 'dmproj';
  readonly version: number;
  readonly savedWith: string;
  readonly elements: readonly Element[];
}

// Messages are shown to the user when a project cannot be opened.
export class ProjectFileError extends Error {
  override readonly name = 'ProjectFileError';
}
