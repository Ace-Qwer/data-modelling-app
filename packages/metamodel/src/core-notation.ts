import type { Notation } from './types';

export const PROJECT_KIND = 'core:Project';
export const MODEL_KIND = 'core:Model';
export const PACKAGE_KIND = 'core:Package';

export const coreNotation: Notation = {
  id: 'core',
  label: 'Core',
  kinds: [
    {
      id: PROJECT_KIND,
      label: 'Project',
      icon: 'project',
      category: 'package',
      allowedOwners: [],
      properties: [],
    },
    {
      id: MODEL_KIND,
      label: 'Model',
      icon: 'model',
      category: 'package',
      allowedOwners: [PROJECT_KIND],
      properties: [],
    },
    {
      id: PACKAGE_KIND,
      label: 'Package',
      icon: 'package',
      category: 'package',
      allowedOwners: [MODEL_KIND, PACKAGE_KIND],
      properties: [],
    },
  ],
};
