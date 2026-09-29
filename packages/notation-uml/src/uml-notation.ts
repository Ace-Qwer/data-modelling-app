import { MODEL_KIND, PACKAGE_KIND, type Notation } from '@dm/metamodel';

export const umlNotation: Notation = {
  id: 'uml',
  label: 'UML',
  kinds: [
    {
      id: 'uml:ClassDiagram',
      label: 'Class Diagram',
      icon: 'diagram',
      category: 'diagram',
      allowedOwners: [MODEL_KIND, PACKAGE_KIND],
      properties: [],
      tools: ['uml:Class', PACKAGE_KIND],
    },
    {
      id: 'uml:Class',
      label: 'Class',
      icon: 'box',
      category: 'element',
      allowedOwners: [MODEL_KIND, PACKAGE_KIND],
      properties: [
        { key: 'isAbstract', label: 'Abstract', type: 'boolean', default: false },
        {
          key: 'visibility',
          label: 'Visibility',
          type: 'enum',
          options: ['public', 'package', 'protected', 'private'],
          default: 'public',
        },
      ],
    },
  ],
};
