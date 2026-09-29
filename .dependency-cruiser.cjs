/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-ui-free',
      comment:
        'Domain packages must stay runnable headless (tests, CLI, future collaboration server).',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: ['react', 'react-dom', '@tauri-apps', '@joint', 'jointjs', 'zustand'] },
    },
    {
      name: 'packages-do-not-import-apps',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'notations-stay-declarative',
      comment:
        'Notations are data read by the registry; depending on core would couple them to model internals.',
      severity: 'error',
      from: { path: '^packages/notation-' },
      to: { path: '^packages/core/' },
    },
    {
      name: 'shell-is-notation-agnostic',
      comment: 'Notations are registered once at startup so the shell works for any of them.',
      severity: 'error',
      from: {
        path: '^apps/desktop/src/',
        pathNot: ['^apps/desktop/src/main\\.tsx$', '^apps/desktop/src/testing/'],
      },
      to: { path: '^packages/notation-' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['\\.test\\.tsx?$', 'vitest\\.config\\.ts$'] },
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'default'],
    },
  },
};
