import type { Element } from '@dm/core';
import { CURRENT_VERSION, ProjectFileError, type ProjectFile } from './project-file';

const NOT_A_PROJECT = 'This file is not a Schemata project.';
const DAMAGED = 'The project file is damaged.';
const NEWER = 'This project was saved by a newer version of Schemata.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isElement(value: unknown): value is Element {
  if (!isRecord(value)) return false;
  const { id, kind, name, ownerId, properties } = value;
  return (
    typeof id === 'string' &&
    typeof kind === 'string' &&
    typeof name === 'string' &&
    (ownerId === null || typeof ownerId === 'string') &&
    isRecord(properties) &&
    Object.values(properties).every((p) => typeof p === 'string' || typeof p === 'boolean')
  );
}

export function parseProject(text: string): ProjectFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ProjectFileError(NOT_A_PROJECT);
  }
  if (!isRecord(data) || data.format !== 'dmproj') throw new ProjectFileError(NOT_A_PROJECT);
  const { version, savedWith, elements } = data;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ProjectFileError(DAMAGED);
  }
  // Checked before the elements: a newer format may shape them differently.
  if (version > CURRENT_VERSION) throw new ProjectFileError(NEWER);
  if (!Array.isArray(elements)) throw new ProjectFileError(DAMAGED);
  const list: unknown[] = elements;
  if (!list.every(isElement)) throw new ProjectFileError(DAMAGED);
  return {
    format: 'dmproj',
    version,
    savedWith: typeof savedWith === 'string' ? savedWith : 'unknown',
    elements: list,
  };
}
