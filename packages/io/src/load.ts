import { Model } from '@dm/core';
import type { Registry } from '@dm/metamodel';
import { migrate } from './migrate';
import { parseProject } from './parse';

export function loadProject(text: string, registry: Registry): Model {
  return Model.load(registry, migrate(parseProject(text)).elements);
}
