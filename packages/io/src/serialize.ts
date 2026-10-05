import type { Element, Model } from '@dm/core';
import { CURRENT_VERSION, type ProjectFile } from './project-file';

const byId = (a: Element, b: Element) => a.id.localeCompare(b.id);

// Parents first so loading is a single pass; siblings by id so unchanged projects save byte-identically.
export function serializeProject(model: Model, savedWith: string): string {
  const elements: Element[] = [];
  const pending = [model.root];
  for (let next = pending.shift(); next; next = pending.shift()) {
    elements.push(next);
    pending.push(...[...model.children(next.id)].sort(byId));
  }
  const file: ProjectFile = { format: 'dmproj', version: CURRENT_VERSION, savedWith, elements };
  return `${JSON.stringify(file, null, 2)}\n`;
}
