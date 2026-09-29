# StarUML-style Layout, Native Menus and Toolbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rearrange the app into StarUML's layout (Toolbox | canvas | Model Explorer over Properties), replace the in-window menu with a native OS menu built from one pure menu model, and add a working Toolbox, a tree context menu, View toggles and an About dialog.

**Architecture:** A pure `buildMenuBar` / `buildTreeContextMenu` turns the action registry into a `MenuNode` tree. In Tauri, `useNativeMenu` translates that tree (via the pure `toNativeSpec`) into Tauri menu objects and keeps enabled and checked states in sync. In the browser and in tests, the existing in-window `MenuBar`, now built on a shared `MenuList`, renders the same tree. A `ShortcutLog` removes the duplicate when a keypress and a native accelerator both fire, so shortcuts are correct however the OS delivers them.

**Tech Stack:** TypeScript ~6.0, React 19.2 (`useEffectEvent`), Zustand 5, react-resizable-panels 4, `@tauri-apps/api` 2.12 (`menu`, `core.isTauri`, `window`), Vitest 5 and Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-staruml-layout-design.md`

## Global Constraints

- TDD is mandatory. Write each test, run it and see it fail for the stated reason before implementing.
- Comments explain _why_ only.
- ESLint runs `strict-type-checked` with `--max-warnings 0`:
  - Arrow functions that call a void function need a block body.
  - Numbers in template literals go through `String()`.
  - No `!` non-null assertions and no empty functions.
  - Callbacks are declared as properties (`readonly f: () => void`), not methods.
  - React Hooks v7 rules apply: don't set state synchronously in an effect body, and don't write refs during render.
- Commit after each task (Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`). Hooks must pass.
- `apps/desktop/src` must never import `@dm/notation-*`, except `main.tsx` and `src/testing/`.
- Exact UI copy:
  - Menus: `File`, `Edit`, `Model`, `View`, `Help`
  - Items: `New Project`, `Exit`, `Undo`, `Redo`, `Delete`, `Add`, `Add Diagram`, `Toolbox`, `Model Explorer`, `Properties`, `About Data Modelling App`
  - Toolbox empty state: `Open a diagram to see its tools`
- Commands run from the repo root: `/home/kat_tielen/Documents/Claude Projects/data-modelling-app`.

## Deliberate refinements of the spec

- **No blocking spike.** Wayland on the dev machine can't be automated, so shortcut routing was designed to be correct in every delivery case instead:
  1. The native accelerator fires and the webview doesn't see the key.
  2. Both fire.
  3. Only the webview sees the key.

  The keydown handler records every matched shortcut in a `ShortcutLog`. A native menu callback within 150 ms of a keypress for the same action is ignored as a duplicate. A native callback without a keypress (case 1, or a mouse click) routes through the action, which undoes the focused field's text or else the model. The manual check in Task 11 confirms this in the real app.

- **Undo/Redo enabled while typing.** Their `isEnabled` is also true while a text field has focus, so the native accelerator is live for text undo. The native adapter resyncs on `focusin`/`focusout`.
- **Exit uses our own action** (`getCurrentWindow().close()`) on Windows and Linux. The predefined native Quit is unsupported on Linux and is used only in the macOS app menu. The `core:window:allow-close` permission is added.
- **Context injection.** `Shell` takes a `platform: Platform` (`isTauri`, `isMac`, `exit`), and `ActionContext` gains `exit` and `textCommand`. Tests inject these directly.

## Review Focus

1. **A context menu opened on a _different_ item than the one selected** must act on the right-clicked item. Right-click selects first. Tested in Task 9.
2. **Hiding both right-hand panels** must leave a working layout: the canvas fills the space and nothing crashes. Tested in Task 10.
3. **A Toolbox click while the active diagram's package has been collapsed in the tree** must reveal the new element. `addElement` expands the owner. Tested in Task 5.
4. **The same keypress delivered twice** (webview plus native accelerator) must undo exactly one step. Tested in Task 4.
5. **Deleting the second-to-last Model** is allowed, and deleting the last is never allowed, including via the context menu. Tested in Task 3.

---

### Task 1: Diagram tools in the metamodel and UML notation

**Files:**

- Modify: `packages/metamodel/src/types.ts`, `packages/metamodel/src/registry.ts`, `packages/metamodel/src/registry.test.ts`
- Modify: `packages/notation-uml/src/uml-notation.ts`, `packages/notation-uml/src/uml-notation.test.ts`

**Interfaces:**

- Produces: `ElementKind.tools?: readonly string[]`, plus registry rejections:
  - `Kind <id> is not a diagram but declares tools`
  - `Diagram <id> offers unknown tool <tool>`
  - `Diagram <id> offers tool <tool> that cannot live where the diagram lives`
- `uml:ClassDiagram.tools = ['uml:Class', 'core:Package']`

- [ ] **Step 1: Write the failing registry tests**

In `packages/metamodel/src/registry.test.ts`, add these rows to the `it.each` rejection table (before its closing `])`):

```ts
    [
      'tools on a kind that is not a diagram',
      [notation(kind({ id: 'test:Thing', tools: ['core:Package'] }))],
      /test:Thing is not a diagram but declares tools/,
    ],
    [
      'an unknown tool',
      [notation(kind({ id: 'test:Board', category: 'diagram', tools: ['test:Ghost'] }))],
      /test:Board offers unknown tool test:Ghost/,
    ],
    [
      'a tool that cannot live where the diagram lives',
      [
        notation(
          kind({ id: 'test:Board', category: 'diagram', allowedOwners: ['core:Package'], tools: ['core:Model'] }),
        ),
      ],
      /test:Board offers tool core:Model that cannot live where the diagram lives/,
    ],
```

And add this test inside `describe('Registry', ...)`:

```ts
it('accepts a diagram whose tools can live where the diagram lives', () => {
  const board = kind({
    id: 'test:Board',
    category: 'diagram',
    allowedOwners: ['core:Package'],
    tools: ['core:Package'],
  });

  expect(Registry.create([notation(board)]).kind('test:Board')?.tools).toEqual(['core:Package']);
});
```

In `packages/notation-uml/src/uml-notation.test.ts`, add:

```ts
it('offers classes and packages in the class diagram toolbox', () => {
  const registry = Registry.create([umlNotation]);

  expect(registry.kind('uml:ClassDiagram')?.tools).toEqual(['uml:Class', 'core:Package']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test packages/metamodel packages/notation-uml`
Expected: FAIL. The three rejection rows fail with `expected [Function] to throw an error`, and the tools assertions see `undefined`. TypeScript errors in the test file don't stop Vitest.

- [ ] **Step 3: Implement**

`packages/metamodel/src/types.ts`: add to `ElementKind`, after `properties`:

```ts
  readonly tools?: readonly string[];
```

`packages/metamodel/src/registry.ts`: in `Registry.create`, extend the owner-checking loop so it reads:

```ts
// Owners and tools are checked only once every notation is known, so notations may reference each other.
for (const kind of kinds.values()) {
  for (const owner of kind.allowedOwners) {
    if (!kinds.has(owner)) throw new Error(`Kind ${kind.id} allows unknown owner ${owner}`);
  }
  assertValidTools(kind, kinds);
}
```

and add at the bottom of the file:

```ts
// A tool's element is created in the diagram's owner, so it must be allowed to live there.
function assertValidTools(kind: ElementKind, kinds: ReadonlyMap<string, ElementKind>): void {
  if (!kind.tools) return;
  if (kind.category !== 'diagram')
    throw new Error(`Kind ${kind.id} is not a diagram but declares tools`);
  for (const toolId of kind.tools) {
    const tool = kinds.get(toolId);
    if (!tool) throw new Error(`Diagram ${kind.id} offers unknown tool ${toolId}`);
    if (!kind.allowedOwners.some((owner) => tool.allowedOwners.includes(owner))) {
      throw new Error(
        `Diagram ${kind.id} offers tool ${toolId} that cannot live where the diagram lives`,
      );
    }
  }
}
```

`packages/notation-uml/src/uml-notation.ts`: add to the `uml:ClassDiagram` kind, after `properties: []`:

```ts
      tools: ['uml:Class', PACKAGE_KIND],
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test packages/metamodel packages/notation-uml`
Expected: PASS.

- [ ] **Step 5: Run the static checks and commit**

Run: `pnpm format && pnpm lint && pnpm typecheck`

```bash
git add packages/metamodel packages/notation-uml
git commit -m "feat(metamodel): let diagram kinds declare their toolbox tools

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: UI store — panel visibility and About state

**Files:**

- Modify: `apps/desktop/src/ui-store.ts`, `apps/desktop/src/ui-store.test.ts`

**Interfaces:**

- Produces:
  - `type PanelName = 'toolbox' | 'explorer' | 'properties'`
  - `UiState.hiddenPanels: ReadonlySet<PanelName>` and `togglePanel(name: PanelName)`
  - `UiState.aboutOpen: boolean`, `openAbout()` and `closeAbout()`

- [ ] **Step 1: Write the failing tests**

Add inside `describe('UI store', ...)` in `apps/desktop/src/ui-store.test.ts`:

```ts
it('hides and shows panels independently', () => {
  const { ui } = setup();

  ui.getState().togglePanel('toolbox');
  ui.getState().togglePanel('properties');
  expect([...ui.getState().hiddenPanels].sort()).toEqual(['properties', 'toolbox']);

  ui.getState().togglePanel('toolbox');
  expect([...ui.getState().hiddenPanels]).toEqual(['properties']);
});

it('opens and closes the About dialog', () => {
  const { ui } = setup();
  expect(ui.getState().aboutOpen).toBe(false);

  ui.getState().openAbout();
  expect(ui.getState().aboutOpen).toBe(true);

  ui.getState().closeAbout();
  expect(ui.getState().aboutOpen).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test apps/desktop/src/ui-store.test.ts`
Expected: FAIL with `ui.getState().togglePanel is not a function`.

- [ ] **Step 3: Implement**

In `apps/desktop/src/ui-store.ts`, add above `UiState`:

```ts
export type PanelName = 'toolbox' | 'explorer' | 'properties';
```

add these members to `UiState`:

```ts
  readonly hiddenPanels: ReadonlySet<PanelName>;
  readonly aboutOpen: boolean;
  togglePanel(name: PanelName): void;
  openAbout(): void;
  closeAbout(): void;
```

and these to the object in `createUiStore` (after `activeDiagramId: null,` and after `activateDiagram` respectively):

```ts
    hiddenPanels: new Set(),
    aboutOpen: false,
```

```ts
    togglePanel: (name) => {
      set((s) => {
        const hiddenPanels = new Set(s.hiddenPanels);
        if (!hiddenPanels.delete(name)) hiddenPanels.add(name);
        return { hiddenPanels };
      });
    },
    openAbout: () => {
      set({ aboutOpen: true });
    },
    closeAbout: () => {
      set({ aboutOpen: false });
    },
```

- [ ] **Step 4: Run the tests, run the checks and commit**

Run: `pnpm test apps/desktop && pnpm format && pnpm lint && pnpm typecheck`
Expected: PASS.

```bash
git add apps/desktop
git commit -m "feat(desktop): track panel visibility and About dialog in the UI store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Actions — split Add, shared `addElement`, last-Model rule, View/Help/Exit, text-aware undo

**Files:**

- Modify: `apps/desktop/src/actions.ts`, `apps/desktop/src/actions.test.ts`, `apps/desktop/src/testing/fixture.ts`
- Create: `apps/desktop/src/platform.ts`
- Modify (callers of removed exports): `apps/desktop/src/Shell.tsx`, `apps/desktop/src/MenuBar.test.tsx`

**Interfaces:**

- Consumes: `UiStore` (with the Task 2 additions), `isTextEntryTarget`.
- Produces:
  - `ActionContext { model; registry; ui; newProject; exit: () => void; textCommand: (command: 'undo' | 'redo') => void }`
  - `Action` gains `isChecked?: (ctx) => boolean`
  - `fileActions` (`file.new`, `file.exit`), `editActions` (unchanged ids), `viewActions` (`view.toolbox`, `view.explorer`, `view.properties`), `helpActions` (`help.about`)
  - `addElementActions(registry)` and `addDiagramActions(registry)`
  - `allActions(registry): readonly Action[]`
  - `addElement(model, ui, kind: ElementKind, ownerId: string): string`, which returns the new id
  - `platform.ts`: `interface Platform { isTauri; isMac; exit }`, `detectPlatform(): Platform` and `runTextCommand(command)`
  - Fixture: `createActionContext` returns `exit` and `textCommand` spies too

- [ ] **Step 1: Update the fixture**

In `apps/desktop/src/testing/fixture.ts`, replace the body of `createActionContext` with:

```ts
const fixture = createFixture(notations);
const ui = createUiStore();
bindToModel(ui, fixture.model);
const newProject = vi.fn<() => void>();
const exit = vi.fn<() => void>();
const textCommand = vi.fn<(command: 'undo' | 'redo') => void>();
const ctx: ActionContext = {
  model: fixture.model,
  registry: fixture.registry,
  ui,
  newProject,
  exit,
  textCommand,
};
return { ...fixture, ui, ctx, newProject, exit, textCommand };
```

- [ ] **Step 2: Rewrite the action tests (failing)**

Replace `apps/desktop/src/actions.test.ts` entirely:

```ts
import { describe, expect, it } from 'vitest';
import {
  addDiagramActions,
  addElementActions,
  allActions,
  editActions,
  fileActions,
  helpActions,
  viewActions,
  type Action,
} from './actions';
import { addElement as addFixtureElement, createActionContext } from './testing/fixture';

function action(actions: readonly Action[], id: string): Action {
  const found = actions.find((a) => a.id === id);
  if (!found) throw new Error(`No action ${id}`);
  return found;
}

describe('Add actions', () => {
  it('split element kinds from diagram kinds', () => {
    const { registry } = createActionContext();

    expect(addElementActions(registry).map((a) => a.id)).toEqual([
      'add.core:Model',
      'add.core:Package',
      'add.uml:Class',
    ]);
    expect(addDiagramActions(registry).map((a) => a.id)).toEqual(['add.uml:ClassDiagram']);
  });

  it('are enabled only for kinds the selected element may own', () => {
    const { registry, ctx, ui, modelId } = createActionContext();
    ui.getState().select(modelId);

    expect(
      addElementActions(registry)
        .filter((a) => a.isEnabled(ctx))
        .map((a) => a.label),
    ).toEqual(['Package', 'Class']);
    expect(addDiagramActions(registry).every((a) => a.isEnabled(ctx))).toBe(true);
  });

  it('are all disabled when nothing is selected', () => {
    const { registry, ctx } = createActionContext();

    expect(
      allActions(registry)
        .filter((a) => a.id.startsWith('add.'))
        .some((a) => a.isEnabled(ctx)),
    ).toBe(false);
  });

  it('create a "New <Kind>" element under the selection, then select and reveal it', () => {
    const { registry, ctx, ui, model, modelId } = createActionContext();
    ui.getState().select(modelId);
    ui.getState().toggleCollapsed(modelId);

    action(addElementActions(registry), 'add.core:Package').run(ctx);

    const [created] = model.children(modelId);
    expect(created).toMatchObject({ kind: 'core:Package', name: 'New Package' });
    expect(ui.getState().selectedId).toBe(created?.id);
    expect(ui.getState().collapsedIds.has(modelId)).toBe(false);
  });
});

describe('Edit actions', () => {
  it('undo and redo the model when no text field has focus', () => {
    const { ctx, model, modelId, textCommand } = createActionContext();
    const undo = action(editActions, 'edit.undo');
    const redo = action(editActions, 'edit.redo');
    expect(undo.isEnabled(ctx)).toBe(false);

    addFixtureElement(model, 'core:Package', modelId, 'Ordering');
    undo.run(ctx);
    expect(model.children(modelId)).toEqual([]);

    redo.run(ctx);
    expect(model.children(modelId)).toHaveLength(1);
    expect(textCommand).not.toHaveBeenCalled();
  });

  it('undo and redo the focused text field instead of the model', () => {
    const { ctx, model, modelId, textCommand } = createActionContext();
    addFixtureElement(model, 'core:Package', modelId, 'Ordering');
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();

    try {
      expect(action(editActions, 'edit.undo').isEnabled(ctx)).toBe(true);
      expect(action(editActions, 'edit.redo').isEnabled(ctx)).toBe(true);
      action(editActions, 'edit.undo').run(ctx);
      action(editActions, 'edit.redo').run(ctx);
    } finally {
      input.remove();
    }

    expect(textCommand.mock.calls).toEqual([['undo'], ['redo']]);
    expect(model.children(modelId)).toHaveLength(1);
  });

  it('never allow deleting the project root or the only Model', () => {
    const { ctx, ui, model, modelId } = createActionContext();
    const del = action(editActions, 'edit.delete');

    ui.getState().select(model.root.id);
    expect(del.isEnabled(ctx)).toBe(false);
    ui.getState().select(modelId);
    expect(del.isEnabled(ctx)).toBe(false);
    ui.getState().select(null);
    expect(del.isEnabled(ctx)).toBe(false);
  });

  it('allow deleting a Model while another one remains', () => {
    const { ctx, ui, model, modelId } = createActionContext();
    const second = addFixtureElement(model, 'core:Model', model.root.id, 'Second');
    const del = action(editActions, 'edit.delete');

    ui.getState().select(modelId);
    expect(del.isEnabled(ctx)).toBe(true);
    del.run(ctx);

    ui.getState().select(second);
    expect(del.isEnabled(ctx)).toBe(false);
  });
});

describe('File, View and Help actions', () => {
  it('start a new project and exit through the context', () => {
    const { ctx, newProject, exit } = createActionContext();

    action(fileActions, 'file.new').run(ctx);
    action(fileActions, 'file.exit').run(ctx);

    expect(newProject).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledOnce();
  });

  it('toggle panels and report them as checked while visible', () => {
    const { ctx, ui } = createActionContext();
    const toolbox = action(viewActions, 'view.toolbox');
    expect(toolbox.isChecked?.(ctx)).toBe(true);

    toolbox.run(ctx);

    expect(ui.getState().hiddenPanels.has('toolbox')).toBe(true);
    expect(toolbox.isChecked?.(ctx)).toBe(false);
  });

  it('open the About dialog', () => {
    const { ctx, ui } = createActionContext();

    action(helpActions, 'help.about').run(ctx);

    expect(ui.getState().aboutOpen).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test apps/desktop/src/actions.test.ts`
Expected: FAIL. `addElementActions is not a function` fails every test that uses it, and `file.exit` and `view.toolbox` are missing (`No action file.exit`).

- [ ] **Step 4: Implement `platform.ts`**

`apps/desktop/src/platform.ts`:

```ts
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export interface Platform {
  readonly isTauri: boolean;
  readonly isMac: boolean;
  readonly exit: () => void;
}

export function detectPlatform(): Platform {
  const inTauri = isTauri();
  return {
    isTauri: inTauri,
    isMac: navigator.userAgent.includes('Mac'),
    exit: () => {
      if (inTauri) void getCurrentWindow().close();
      else window.close();
    },
  };
}

// WebKit offers no other way to drive a text field's own undo stack from outside a keypress.
export function runTextCommand(command: 'undo' | 'redo'): void {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- see the comment above
  document.execCommand(command);
}
```

- [ ] **Step 5: Implement the actions**

Replace `apps/desktop/src/actions.ts` entirely:

```ts
import type { Element, Model } from '@dm/core';
import { MODEL_KIND, PROJECT_KIND, type ElementKind, type Registry } from '@dm/metamodel';
import { ulid } from 'ulid';
import { isTextEntryTarget } from './shortcuts';
import type { PanelName, UiStore } from './ui-store';

export interface ActionContext {
  readonly model: Model;
  readonly registry: Registry;
  readonly ui: UiStore;
  readonly newProject: () => void;
  readonly exit: () => void;
  readonly textCommand: (command: 'undo' | 'redo') => void;
}

export interface Action {
  readonly id: string;
  readonly label: string;
  readonly shortcuts?: readonly string[];
  readonly isEnabled: (ctx: ActionContext) => boolean;
  readonly isChecked?: (ctx: ActionContext) => boolean;
  readonly run: (ctx: ActionContext) => void;
}

const always = () => true;

function selectedElement(ctx: ActionContext): Element | undefined {
  const { selectedId } = ctx.ui.getState();
  return selectedId === null ? undefined : ctx.model.getElement(selectedId);
}

function isTyping(): boolean {
  return isTextEntryTarget(document.activeElement);
}

export function addElement(model: Model, ui: UiStore, kind: ElementKind, ownerId: string): string {
  const id = ulid();
  ui.getState().expand(ownerId);
  model.execute({
    type: 'AddElement',
    element: { id, kind: kind.id, name: `New ${kind.label}`, ownerId, properties: {} },
  });
  ui.getState().select(id);
  return id;
}

// Every project keeps its root and at least one Model, so there is always somewhere to add elements.
function isDeletable(ctx: ActionContext, element: Element): boolean {
  if (element.kind === PROJECT_KIND) return false;
  if (element.kind !== MODEL_KIND) return true;
  return ctx.model.elements().filter((e) => e.kind === MODEL_KIND).length > 1;
}

export const fileActions: readonly Action[] = [
  {
    id: 'file.new',
    label: 'New Project',
    isEnabled: always,
    run: (ctx) => {
      ctx.newProject();
    },
  },
  {
    id: 'file.exit',
    label: 'Exit',
    isEnabled: always,
    run: (ctx) => {
      ctx.exit();
    },
  },
];

export const editActions: readonly Action[] = [
  {
    id: 'edit.undo',
    label: 'Undo',
    shortcuts: ['Mod+Z'],
    isEnabled: (ctx) => ctx.model.canUndo || isTyping(),
    run: (ctx) => {
      if (isTyping()) ctx.textCommand('undo');
      else ctx.model.undo();
    },
  },
  {
    id: 'edit.redo',
    label: 'Redo',
    shortcuts: ['Mod+Shift+Z', 'Mod+Y'],
    isEnabled: (ctx) => ctx.model.canRedo || isTyping(),
    run: (ctx) => {
      if (isTyping()) ctx.textCommand('redo');
      else ctx.model.redo();
    },
  },
  {
    id: 'edit.delete',
    label: 'Delete',
    shortcuts: ['Delete'],
    isEnabled: (ctx) => {
      const element = selectedElement(ctx);
      return element !== undefined && isDeletable(ctx, element);
    },
    run: (ctx) => {
      const element = selectedElement(ctx);
      if (element && isDeletable(ctx, element)) {
        ctx.model.execute({ type: 'RemoveElement', id: element.id });
      }
    },
  },
];

function panelToggle(id: string, label: string, panel: PanelName): Action {
  return {
    id,
    label,
    isEnabled: always,
    isChecked: (ctx) => !ctx.ui.getState().hiddenPanels.has(panel),
    run: (ctx) => {
      ctx.ui.getState().togglePanel(panel);
    },
  };
}

export const viewActions: readonly Action[] = [
  panelToggle('view.toolbox', 'Toolbox', 'toolbox'),
  panelToggle('view.explorer', 'Model Explorer', 'explorer'),
  panelToggle('view.properties', 'Properties', 'properties'),
];

export const helpActions: readonly Action[] = [
  {
    id: 'help.about',
    label: 'About Data Modelling App',
    isEnabled: always,
    run: (ctx) => {
      ctx.ui.getState().openAbout();
    },
  },
];

function addKindAction(kind: ElementKind): Action {
  return {
    id: `add.${kind.id}`,
    label: kind.label,
    isEnabled: (ctx) => {
      const owner = selectedElement(ctx);
      return owner !== undefined && kind.allowedOwners.includes(owner.kind);
    },
    run: (ctx) => {
      const owner = selectedElement(ctx);
      if (owner && kind.allowedOwners.includes(owner.kind))
        addElement(ctx.model, ctx.ui, kind, owner.id);
    },
  };
}

export function addElementActions(registry: Registry): readonly Action[] {
  return registry
    .kinds()
    .filter((kind) => kind.id !== PROJECT_KIND && kind.category !== 'diagram')
    .map(addKindAction);
}

export function addDiagramActions(registry: Registry): readonly Action[] {
  return registry
    .kinds()
    .filter((kind) => kind.category === 'diagram')
    .map(addKindAction);
}

export function allActions(registry: Registry): readonly Action[] {
  return [
    ...fileActions,
    ...editActions,
    ...viewActions,
    ...helpActions,
    ...addElementActions(registry),
    ...addDiagramActions(registry),
  ];
}
```

- [ ] **Step 6: Keep the callers compiling**

`addActions` no longer exists, and `ActionContext` has two new members. Tasks 6 and 10 rewrite `MenuBar` and `Shell` anyway. For now:

- In `apps/desktop/src/Shell.tsx`:
  - replace the import `addActions` with `addDiagramActions, addElementActions`;
  - replace `{ label: 'Add', actions: addActions(registry) }` with `{ label: 'Add', actions: [...addElementActions(registry), ...addDiagramActions(registry)] }`;
  - add to the `ctx` object `exit: () => { window.close(); }, textCommand: runTextCommand,` and import `runTextCommand` from `./platform`.
- `apps/desktop/src/MenuBar.test.tsx` has no changes to make yet: it only uses `fileActions` and `editActions`. Its test `'runs an item and closes the menu'` still passes, because _New Project_ is the first File item.

Run: `pnpm test apps/desktop && pnpm typecheck`
Expected: PASS. The Shell journeys still work, because the Add menu still lists Package, Class and Class Diagram.

- [ ] **Step 7: Run the static checks and commit**

Run: `pnpm format && pnpm lint && pnpm depcruise`

```bash
git add apps/desktop
git commit -m "feat(desktop): split Add into element and diagram actions and add View, Help and Exit

Undo and redo now act on the focused text field when typing, and only the
last remaining Model is protected from deletion.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Menu model and shortcut de-duplication

**Files:**

- Create: `apps/desktop/src/menu/menu-model.ts`, `apps/desktop/src/menu/shortcut-log.ts`
- Modify: `apps/desktop/src/use-shortcuts.ts`
- Test: `apps/desktop/src/menu/menu-model.test.ts`, `apps/desktop/src/menu/shortcut-log.test.ts`

**Interfaces:**

- Consumes: Task 3 actions.
- Produces:
  - `type MenuNode = { kind: 'item'; id; label; shortcut?; enabled; checked? } | { kind: 'submenu'; label; children } | { kind: 'separator' }`
  - `interface TopMenu { label; children }` and `interface MenuEnvironment { isTauri; isMac }`
  - `buildMenuBar(ctx, env): readonly TopMenu[]`, which reads `ctx.registry`
  - `buildTreeContextMenu(ctx): readonly MenuNode[]`
  - `runMenuItem(id, ctx): void`
  - `createShortcutLog(): ShortcutLog { note(actionId, now?); wasJustKeyed(actionId, now?) }`
  - `useShortcuts(actions, ctx, log)`, which now takes the log

- [ ] **Step 1: Write the failing tests**

`apps/desktop/src/menu/menu-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addElement, createActionContext } from '../testing/fixture';
import { buildMenuBar, buildTreeContextMenu, runMenuItem, type MenuNode } from './menu-model';

const desktop = { isTauri: true, isMac: false };

function find(nodes: readonly MenuNode[], label: string): MenuNode {
  const node = nodes.find((n) => n.kind !== 'separator' && n.label === label);
  if (!node) throw new Error(`No menu node ${label}`);
  return node;
}

function children(node: MenuNode): readonly MenuNode[] {
  if (node.kind !== 'submenu') throw new Error('Not a submenu');
  return node.children;
}

function labels(nodes: readonly MenuNode[]): string[] {
  return nodes.map((n) => (n.kind === 'separator' ? '---' : n.label));
}

describe('buildMenuBar', () => {
  it('has StarUML-style top-level menus', () => {
    const { ctx } = createActionContext();

    expect(buildMenuBar(ctx, desktop).map((m) => m.label)).toEqual([
      'File',
      'Edit',
      'Model',
      'View',
      'Help',
    ]);
  });

  it('shows Exit in File only for Tauri on Windows and Linux', () => {
    const { ctx } = createActionContext();
    const file = (env: { isTauri: boolean; isMac: boolean }) =>
      labels(buildMenuBar(ctx, env)[0]?.children ?? []);

    expect(file(desktop)).toEqual(['New Project', '---', 'Exit']);
    expect(file({ isTauri: true, isMac: true })).toEqual(['New Project']);
    expect(file({ isTauri: false, isMac: false })).toEqual(['New Project']);
  });

  it('builds Model → Add and Add Diagram from the registry, enabled per selection', () => {
    const { ctx, ui, modelId } = createActionContext();
    ui.getState().select(modelId);

    const model = buildMenuBar(ctx, desktop)[2]?.children ?? [];
    const add = children(find(model, 'Add'));

    expect(labels(add)).toEqual(['Model', 'Package', 'Class']);
    expect(add.map((n) => n.kind === 'item' && n.enabled)).toEqual([false, true, true]);
    expect(labels(children(find(model, 'Add Diagram')))).toEqual(['Class Diagram']);
  });

  it('reports visible panels as checked View items', () => {
    const { ctx, ui } = createActionContext();
    ui.getState().togglePanel('explorer');

    const view = buildMenuBar(ctx, desktop)[3]?.children ?? [];

    expect(view.map((n) => n.kind === 'item' && n.checked)).toEqual([true, false, true]);
  });

  it('carries the first shortcut of each item', () => {
    const { ctx } = createActionContext();

    const edit = buildMenuBar(ctx, desktop)[1]?.children ?? [];

    expect(edit.map((n) => (n.kind === 'item' ? n.shortcut : undefined))).toEqual([
      'Mod+Z',
      'Mod+Shift+Z',
      undefined,
      'Delete',
    ]);
  });
});

describe('buildTreeContextMenu', () => {
  it('offers Add, Add Diagram and Delete for the selection', () => {
    const { ctx, ui, model, modelId } = createActionContext();
    ui.getState().select(addElement(model, 'core:Package', modelId, 'Ordering'));

    const menu = buildTreeContextMenu(ctx);

    expect(labels(menu)).toEqual(['Add', 'Add Diagram', '---', 'Delete']);
    expect(find(menu, 'Delete')).toMatchObject({ enabled: true });
  });
});

describe('runMenuItem', () => {
  it('runs an enabled action by id and ignores disabled or unknown ids', () => {
    const { ctx, ui, model, modelId } = createActionContext();
    ui.getState().select(modelId);

    runMenuItem('add.core:Package', ctx);
    runMenuItem('add.core:Model', ctx);
    runMenuItem('no.such.action', ctx);

    expect(model.children(modelId).map((e) => e.kind)).toEqual(['core:Package']);
  });
});
```

`apps/desktop/src/menu/shortcut-log.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createShortcutLog } from './shortcut-log';

describe('ShortcutLog', () => {
  it('reports an action as just keyed shortly after its keypress', () => {
    const log = createShortcutLog();

    log.note('edit.undo', 1000);

    expect(log.wasJustKeyed('edit.undo', 1100)).toBe(true);
    expect(log.wasJustKeyed('edit.redo', 1100)).toBe(false);
  });

  it('forgets a keypress once the duplicate window has passed', () => {
    const log = createShortcutLog();

    log.note('edit.undo', 1000);

    expect(log.wasJustKeyed('edit.undo', 1200)).toBe(false);
  });

  it('knows nothing before any keypress', () => {
    expect(createShortcutLog().wasJustKeyed('edit.undo', 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test apps/desktop/src/menu`
Expected: FAIL with `Failed to resolve import "./menu-model"` and `Failed to resolve import "./shortcut-log"`.

- [ ] **Step 3: Implement**

`apps/desktop/src/menu/shortcut-log.ts`:

```ts
// A native accelerator and the webview's keydown can both report one keypress; anything
// closer together than this is the same press.
const DUPLICATE_WINDOW_MS = 150;

export interface ShortcutLog {
  readonly note: (actionId: string, now?: number) => void;
  readonly wasJustKeyed: (actionId: string, now?: number) => boolean;
}

export function createShortcutLog(): ShortcutLog {
  const lastKeyed = new Map<string, number>();
  return {
    note: (actionId, now = performance.now()) => {
      lastKeyed.set(actionId, now);
    },
    wasJustKeyed: (actionId, now = performance.now()) => {
      const at = lastKeyed.get(actionId);
      return at !== undefined && now - at < DUPLICATE_WINDOW_MS;
    },
  };
}
```

`apps/desktop/src/menu/menu-model.ts`:

```ts
import {
  addDiagramActions,
  addElementActions,
  allActions,
  editActions,
  fileActions,
  helpActions,
  viewActions,
  type Action,
  type ActionContext,
} from '../actions';

export type MenuNode =
  | {
      readonly kind: 'item';
      readonly id: string;
      readonly label: string;
      readonly shortcut?: string;
      readonly enabled: boolean;
      readonly checked?: boolean;
    }
  | { readonly kind: 'submenu'; readonly label: string; readonly children: readonly MenuNode[] }
  | { readonly kind: 'separator' };

export interface TopMenu {
  readonly label: string;
  readonly children: readonly MenuNode[];
}

export interface MenuEnvironment {
  readonly isTauri: boolean;
  readonly isMac: boolean;
}

const separator: MenuNode = { kind: 'separator' };

function item(action: Action, ctx: ActionContext): MenuNode {
  const shortcut = action.shortcuts?.[0];
  return {
    kind: 'item',
    id: action.id,
    label: action.label,
    enabled: action.isEnabled(ctx),
    ...(shortcut === undefined ? {} : { shortcut }),
    ...(action.isChecked ? { checked: action.isChecked(ctx) } : {}),
  };
}

function byId(actions: readonly Action[], id: string): Action {
  const action = actions.find((a) => a.id === id);
  if (!action) throw new Error(`Unknown action ${id}`);
  return action;
}

function addSubmenus(ctx: ActionContext): MenuNode[] {
  return [
    {
      kind: 'submenu',
      label: 'Add',
      children: addElementActions(ctx.registry).map((a) => item(a, ctx)),
    },
    {
      kind: 'submenu',
      label: 'Add Diagram',
      children: addDiagramActions(ctx.registry).map((a) => item(a, ctx)),
    },
  ];
}

export function buildMenuBar(ctx: ActionContext, env: MenuEnvironment): readonly TopMenu[] {
  // macOS puts Quit in the app menu, and outside Tauri there is no window to exit.
  const showExit = env.isTauri && !env.isMac;
  return [
    {
      label: 'File',
      children: [
        item(byId(fileActions, 'file.new'), ctx),
        ...(showExit ? [separator, item(byId(fileActions, 'file.exit'), ctx)] : []),
      ],
    },
    {
      label: 'Edit',
      children: [
        item(byId(editActions, 'edit.undo'), ctx),
        item(byId(editActions, 'edit.redo'), ctx),
        separator,
        item(byId(editActions, 'edit.delete'), ctx),
      ],
    },
    { label: 'Model', children: addSubmenus(ctx) },
    { label: 'View', children: viewActions.map((a) => item(a, ctx)) },
    { label: 'Help', children: helpActions.map((a) => item(a, ctx)) },
  ];
}

export function buildTreeContextMenu(ctx: ActionContext): readonly MenuNode[] {
  return [...addSubmenus(ctx), separator, item(byId(editActions, 'edit.delete'), ctx)];
}

export function runMenuItem(id: string, ctx: ActionContext): void {
  const action = allActions(ctx.registry).find((a) => a.id === id);
  if (action?.isEnabled(ctx)) action.run(ctx);
}
```

`apps/desktop/src/use-shortcuts.ts` (full replacement):

```ts
import { useEffect } from 'react';
import type { Action, ActionContext } from './actions';
import type { ShortcutLog } from './menu/shortcut-log';
import { isMacPlatform, isTextEntryTarget, matchesShortcut } from './shortcuts';

export function useShortcuts(
  actions: readonly Action[],
  ctx: ActionContext,
  log: ShortcutLog,
): void {
  useEffect(() => {
    const isMac = isMacPlatform();
    const onKeyDown = (event: KeyboardEvent) => {
      const action = actions.find((a) =>
        a.shortcuts?.some((s) => matchesShortcut(event, s, isMac)),
      );
      if (!action) return;
      log.note(action.id);
      // The field's own editing (text undo, Delete) handles keys while the user is typing.
      if (isTextEntryTarget(event.target)) return;
      if (!action.isEnabled(ctx)) return;
      event.preventDefault();
      action.run(ctx);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [actions, ctx, log]);
}
```

In `apps/desktop/src/Shell.tsx`, keep it compiling: import `createShortcutLog` from `./menu/shortcut-log`, add `const [shortcutLog] = useState(createShortcutLog);`, and change the call to `useShortcuts(allActions, ctx, shortcutLog);`. The local `allActions` variable there is replaced in Task 10.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test apps/desktop`
Expected: PASS.

- [ ] **Step 5: Run the static checks and commit**

Run: `pnpm format && pnpm lint && pnpm typecheck`

```bash
git add apps/desktop
git commit -m "feat(desktop): add pure menu model and shortcut de-duplication log

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Toolbox panel

**Files:**

- Create: `apps/desktop/src/Toolbox.tsx`
- Test: `apps/desktop/src/Toolbox.test.tsx`

**Interfaces:**

- Consumes: `PanelProps`, `addElement` (Task 3), `KindIcon`, `useModel`, `ElementKind.tools` (Task 1).
- Produces: `Toolbox(props: PanelProps)`, which renders `role="toolbar"` with `aria-label="Toolbox"`.

- [ ] **Step 1: Write the failing tests**

`apps/desktop/src/Toolbox.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addElement, createActionContext } from './testing/fixture';
import { Toolbox } from './Toolbox';

function renderToolbox() {
  const fixture = createActionContext();
  const pkg = addElement(fixture.model, 'core:Package', fixture.modelId, 'Ordering');
  const diagram = addElement(fixture.model, 'uml:ClassDiagram', pkg, 'Overview');
  render(<Toolbox model={fixture.model} registry={fixture.registry} ui={fixture.ui} />);
  return { ...fixture, pkg, diagram, user: userEvent.setup() };
}

describe('Toolbox', () => {
  it('asks for a diagram when none is active', () => {
    renderToolbox();

    expect(screen.getByText('Open a diagram to see its tools')).toBeInTheDocument();
  });

  it("shows the active diagram's tools under the diagram kind's name", () => {
    const { ui, diagram } = renderToolbox();

    act(() => {
      ui.getState().openDiagram(diagram);
    });

    expect(screen.getByRole('toolbar', { name: 'Toolbox' })).toBeInTheDocument();
    expect(screen.getByText('Class Diagram')).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Class', 'Package']);
  });

  it("adds the tool's element to the diagram's package, selected, as one undo step", async () => {
    const { ui, diagram, pkg, model, user } = renderToolbox();
    act(() => {
      ui.getState().openDiagram(diagram);
    });

    await user.click(screen.getByRole('button', { name: 'Class' }));

    const created = model.children(pkg).find((e) => e.kind === 'uml:Class');
    expect(created?.name).toBe('New Class');
    expect(ui.getState().selectedId).toBe(created?.id);
    act(() => {
      model.undo();
    });
    expect(model.children(pkg).some((e) => e.kind === 'uml:Class')).toBe(false);
  });

  it('reveals the new element even when the package is collapsed in the tree', async () => {
    const { ui, diagram, pkg, user } = renderToolbox();
    act(() => {
      ui.getState().openDiagram(diagram);
      ui.getState().toggleCollapsed(pkg);
    });

    await user.click(screen.getByRole('button', { name: 'Package' }));

    expect(ui.getState().collapsedIds.has(pkg)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test apps/desktop/src/Toolbox.test.tsx`
Expected: FAIL with `Failed to resolve import "./Toolbox"`.

- [ ] **Step 3: Implement**

`apps/desktop/src/Toolbox.tsx`:

```tsx
import { useStore } from 'zustand';
import { addElement } from './actions';
import { KindIcon } from './icons';
import type { PanelProps } from './panel-props';
import { useModel } from './use-model';

export function Toolbox({ model, registry, ui }: PanelProps) {
  useModel(model);
  const activeId = useStore(ui, (s) => s.activeDiagramId);
  const diagram = activeId === null ? undefined : model.getElement(activeId);
  const diagramKind = diagram ? registry.kind(diagram.kind) : undefined;
  const ownerId = diagram?.ownerId ?? null;

  if (!diagramKind || ownerId === null) {
    return (
      <div className="panel toolbox">
        <h2 className="panel-title">Toolbox</h2>
        <p className="panel-empty">Open a diagram to see its tools</p>
      </div>
    );
  }

  const tools = (diagramKind.tools ?? []).flatMap((id) => {
    const kind = registry.kind(id);
    return kind ? [kind] : [];
  });

  return (
    <div className="panel toolbox">
      <h2 className="panel-title">Toolbox</h2>
      <p className="toolbox-heading">{diagramKind.label}</p>
      <div
        className="toolbox-tools"
        role="toolbar"
        aria-label="Toolbox"
        aria-orientation="vertical"
      >
        {tools.map((kind) => (
          <button
            type="button"
            className="toolbox-tool"
            key={kind.id}
            onClick={() => {
              addElement(model, ui, kind, ownerId);
            }}
          >
            <KindIcon icon={kind.icon} />
            {kind.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests, run the checks and commit**

Run: `pnpm test apps/desktop && pnpm format && pnpm lint && pnpm typecheck && pnpm depcruise`
Expected: PASS.

```bash
git add apps/desktop
git commit -m "feat(desktop): add Toolbox offering the active diagram's tools

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: In-window menus render the menu model (MenuList, MenuBar, ContextMenu)

**Files:**

- Create: `apps/desktop/src/menu/MenuList.tsx`, `apps/desktop/src/menu/ContextMenu.tsx`, `apps/desktop/src/menu/use-dismiss.ts`
- Modify (full rewrite): `apps/desktop/src/MenuBar.tsx`, `apps/desktop/src/MenuBar.test.tsx`
- Test: `apps/desktop/src/menu/ContextMenu.test.tsx`

**Interfaces:**

- Consumes: `MenuNode` and `TopMenu` (Task 4), `formatShortcut`.
- Produces:
  - `MenuList({ label, nodes, isMac, onRun })`
  - `MenuBar({ menus, isMac, onRun })`
  - `ContextMenu({ nodes, at: { x; y }, isMac, onRun, onClose })`
  - `useDismiss(active, ref, onClose)`, which closes on Escape or a click outside `ref`

Items render as `role="menuitem"`, or as `role="menuitemcheckbox"` with `aria-checked` when `checked` is defined. Submenus render as `role="menuitem"` with `aria-haspopup="menu"`, and a click toggles a nested `role="menu"`.

- [ ] **Step 1: Write the failing tests**

Replace `apps/desktop/src/MenuBar.test.tsx` entirely:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TopMenu } from './menu/menu-model';
import { MenuBar } from './MenuBar';

const menus: readonly TopMenu[] = [
  {
    label: 'Edit',
    children: [
      { kind: 'item', id: 'edit.undo', label: 'Undo', shortcut: 'Mod+Z', enabled: false },
      { kind: 'separator' },
      { kind: 'item', id: 'edit.delete', label: 'Delete', shortcut: 'Delete', enabled: true },
    ],
  },
  {
    label: 'Model',
    children: [
      {
        kind: 'submenu',
        label: 'Add',
        children: [{ kind: 'item', id: 'add.core:Package', label: 'Package', enabled: true }],
      },
    ],
  },
  {
    label: 'View',
    children: [
      { kind: 'item', id: 'view.toolbox', label: 'Toolbox', enabled: true, checked: false },
    ],
  },
];

function renderMenuBar() {
  const onRun = vi.fn<(id: string) => void>();
  render(<MenuBar menus={menus} isMac={false} onRun={onRun} />);
  return { onRun, user: userEvent.setup() };
}

describe('MenuBar', () => {
  it('opens a menu with its items, separators, enabled states and shortcut hints', async () => {
    const { user } = renderMenuBar();

    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(screen.getByRole('menuitem', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Undo' })).toHaveTextContent('Ctrl+Z');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeEnabled();
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('opens a submenu and runs its item, closing the menus', async () => {
    const { user, onRun } = renderMenuBar();

    await user.click(screen.getByRole('menuitem', { name: 'Model' }));
    await user.click(screen.getByRole('menuitem', { name: 'Add' }));
    await user.click(screen.getByRole('menuitem', { name: 'Package' }));

    expect(onRun).toHaveBeenCalledWith('add.core:Package');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders checkable items with their checked state', async () => {
    const { user } = renderMenuBar();

    await user.click(screen.getByRole('menuitem', { name: 'View' }));

    expect(screen.getByRole('menuitemcheckbox', { name: 'Toolbox' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('closes on Escape and on a click outside', async () => {
    const { user } = renderMenuBar();
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
```

`apps/desktop/src/menu/ContextMenu.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContextMenu } from './ContextMenu';
import type { MenuNode } from './menu-model';

const nodes: readonly MenuNode[] = [
  { kind: 'item', id: 'edit.delete', label: 'Delete', shortcut: 'Delete', enabled: true },
];

function renderContextMenu() {
  const onRun = vi.fn<(id: string) => void>();
  const onClose = vi.fn<() => void>();
  render(
    <ContextMenu
      nodes={nodes}
      at={{ x: 40, y: 60 }}
      isMac={false}
      onRun={onRun}
      onClose={onClose}
    />,
  );
  return { onRun, onClose, user: userEvent.setup() };
}

describe('ContextMenu', () => {
  it('appears at the pointer', () => {
    renderContextMenu();

    expect(screen.getByRole('menu', { name: 'Context menu' }).parentElement).toHaveStyle({
      left: '40px',
      top: '60px',
    });
  });

  it('runs an item and closes', async () => {
    const { user, onRun, onClose } = renderContextMenu();

    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(onRun).toHaveBeenCalledWith('edit.delete');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const { user, onClose } = renderContextMenu();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test apps/desktop/src/MenuBar.test.tsx apps/desktop/src/menu/ContextMenu.test.tsx`
Expected: FAIL. `ContextMenu` can't be resolved. The MenuBar tests fail because the component still expects `menus` of actions and a `ctx` (for example `Cannot read properties of undefined (reading 'model')`).

- [ ] **Step 3: Implement**

`apps/desktop/src/menu/use-dismiss.ts`:

```ts
import { useEffect, type RefObject } from 'react';

export function useDismiss(
  active: boolean,
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const onMouseDown = (event: MouseEvent) => {
      if (event.target instanceof Node && ref.current?.contains(event.target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [active, ref, onClose]);
}
```

`apps/desktop/src/menu/MenuList.tsx`:

```tsx
import { useState } from 'react';
import { formatShortcut } from '../shortcuts';
import type { MenuNode } from './menu-model';

interface MenuListProps {
  readonly label: string;
  readonly nodes: readonly MenuNode[];
  readonly isMac: boolean;
  readonly onRun: (id: string) => void;
}

export function MenuList({ label, nodes, isMac, onRun }: MenuListProps) {
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  return (
    <div className="menu-popup" role="menu" aria-label={label}>
      {nodes.map((node, index) => {
        switch (node.kind) {
          case 'separator':
            return (
              <div key={`separator-${String(index)}`} className="menu-separator" role="separator" />
            );
          case 'submenu':
            return (
              <div key={node.label} className="menu-submenu">
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={openSubmenu === node.label}
                  onClick={() => {
                    setOpenSubmenu(openSubmenu === node.label ? null : node.label);
                  }}
                >
                  <span className="menu-check" />
                  <span>{node.label}</span>
                  <span className="menu-shortcut" aria-hidden="true">
                    ▸
                  </span>
                </button>
                {openSubmenu === node.label && (
                  <MenuList label={node.label} nodes={node.children} isMac={isMac} onRun={onRun} />
                )}
              </div>
            );
          case 'item':
            return (
              <button
                type="button"
                key={node.id}
                role={node.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                aria-checked={node.checked}
                disabled={!node.enabled}
                onClick={() => {
                  onRun(node.id);
                }}
              >
                <span className="menu-check" aria-hidden="true">
                  {node.checked === true ? '✓' : ''}
                </span>
                <span>{node.label}</span>
                {node.shortcut !== undefined && (
                  <span className="menu-shortcut" aria-hidden="true">
                    {formatShortcut(node.shortcut, isMac)}
                  </span>
                )}
              </button>
            );
        }
      })}
    </div>
  );
}
```

`apps/desktop/src/MenuBar.tsx` (full replacement):

```tsx
import { useCallback, useRef, useState } from 'react';
import type { TopMenu } from './menu/menu-model';
import { MenuList } from './menu/MenuList';
import { useDismiss } from './menu/use-dismiss';

interface MenuBarProps {
  readonly menus: readonly TopMenu[];
  readonly isMac: boolean;
  readonly onRun: (id: string) => void;
}

export function MenuBar({ menus, isMac, onRun }: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    setOpenMenu(null);
  }, []);
  useDismiss(openMenu !== null, barRef, close);

  return (
    <div className="menu-bar" role="menubar" ref={barRef}>
      {menus.map((menu) => (
        <div className="menu" key={menu.label}>
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={openMenu === menu.label}
            onClick={() => {
              setOpenMenu(openMenu === menu.label ? null : menu.label);
            }}
          >
            {menu.label}
          </button>
          {openMenu === menu.label && (
            <MenuList
              label={menu.label}
              nodes={menu.children}
              isMac={isMac}
              onRun={(id) => {
                close();
                onRun(id);
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
```

`apps/desktop/src/menu/ContextMenu.tsx`:

```tsx
import { useRef } from 'react';
import type { MenuNode } from './menu-model';
import { MenuList } from './MenuList';
import { useDismiss } from './use-dismiss';

interface ContextMenuProps {
  readonly nodes: readonly MenuNode[];
  readonly at: { readonly x: number; readonly y: number };
  readonly isMac: boolean;
  readonly onRun: (id: string) => void;
  readonly onClose: () => void;
}

export function ContextMenu({ nodes, at, isMac, onRun, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(true, ref, onClose);
  return (
    <div className="context-menu" ref={ref} style={{ left: at.x, top: at.y }}>
      <MenuList
        label="Context menu"
        nodes={nodes}
        isMac={isMac}
        onRun={(id) => {
          onClose();
          onRun(id);
        }}
      />
    </div>
  );
}
```

Keep `Shell.tsx` compiling. Replace its `menus`/`MenuBar` usage with the menu model:

- import `buildMenuBar` and `runMenuItem` from `./menu/menu-model`;
- delete the local `menus` memo;
- set `const actions = useMemo(() => allActions(registry), [registry]);`, importing `allActions` from `./actions`, and pass `actions` to `useShortcuts`;
- render `<MenuBar menus={buildMenuBar(ctx, { isTauri: false, isMac: isMacPlatform() })} isMac={isMacPlatform()} onRun={(id) => { runMenuItem(id, ctx); }} />`;
- add `useModel(model)` and `useStore(ui)` at the top of `Shell` (importing `useModel` from `./use-model` and `useStore` from `zustand`), so the menu model re-renders with selection and model changes.

In `apps/desktop/src/Shell.test.tsx`, update the `menu` helper and the journeys to the new structure. _Add_ is now _Model → Add ▸ …_, and _Add Diagram_ is its own submenu:

```tsx
async function menu(user: ReturnType<typeof userEvent.setup>, ...path: string[]) {
  const [top, ...rest] = path;
  await user.click(screen.getByRole('menuitem', { name: top }));
  for (const entry of rest) {
    // View entries are check items, so look for both item roles; the newest popup renders last.
    const matches = [
      ...screen.queryAllByRole('menuitem', { name: entry }),
      ...screen.queryAllByRole('menuitemcheckbox', { name: entry }),
    ];
    await user.click(matches.at(-1) ?? document.body);
  }
}
```

Replace the call sites as follows:

- `menu(user, 'Add', 'Package')` → `menu(user, 'Model', 'Add', 'Package')`
- `menu(user, 'Add', 'Class Diagram')` → `menu(user, 'Model', 'Add Diagram', 'Class Diagram')`
- `menu(user, 'Add', 'Class')` → `menu(user, 'Model', 'Add', 'Class')`

Leave `menu(user, 'Edit', …)` and `menu(user, 'File', …)` unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test apps/desktop`
Expected: PASS.

- [ ] **Step 5: Run the static checks and commit**

Run: `pnpm format && pnpm lint && pnpm typecheck`

```bash
git add apps/desktop
git commit -m "feat(desktop): render menus from the menu model with submenus and check items

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: About dialog and app version

**Files:**

- Create: `apps/desktop/app-version.ts`, `apps/desktop/src/env.d.ts`, `apps/desktop/src/AboutDialog.tsx`
- Modify: `apps/desktop/vite.config.ts`, `apps/desktop/vitest.config.ts`, `apps/desktop/tsconfig.json`
- Test: `apps/desktop/src/AboutDialog.test.tsx`

**Interfaces:**

- Produces:
  - `readAppVersion(): string`, read from `src-tauri/tauri.conf.json`
  - the global `__APP_VERSION__: string`
  - `AboutDialog({ ui })`: `role="dialog"` named "Data Modelling App"

- [ ] **Step 1: Write the failing test**

`apps/desktop/src/AboutDialog.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AboutDialog } from './AboutDialog';
import { createUiStore } from './ui-store';

function renderAbout() {
  const ui = createUiStore();
  render(<AboutDialog ui={ui} />);
  return { ui, user: userEvent.setup() };
}

describe('AboutDialog', () => {
  it('is hidden until opened', () => {
    renderAbout();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the app name and its version', () => {
    const { ui } = renderAbout();

    act(() => {
      ui.getState().openAbout();
    });

    expect(screen.getByRole('dialog', { name: 'Data Modelling App' })).toHaveTextContent(
      /Version \d+\.\d+\.\d+/,
    );
  });

  it('closes with the Close button or Escape', async () => {
    const { ui, user } = renderAbout();
    act(() => {
      ui.getState().openAbout();
    });

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      ui.getState().openAbout();
    });
    await user.keyboard('{Escape}');
    expect(ui.getState().aboutOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test apps/desktop/src/AboutDialog.test.tsx`
Expected: FAIL with `Failed to resolve import "./AboutDialog"`.

- [ ] **Step 3: Implement**

`apps/desktop/app-version.ts`:

```ts
import { readFileSync } from 'node:fs';

// The Tauri config is the single source of the version shipped to users.
export function readAppVersion(): string {
  const config = JSON.parse(
    readFileSync(new URL('./src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
  ) as { version: string };
  return config.version;
}
```

`apps/desktop/src/env.d.ts`:

```ts
declare const __APP_VERSION__: string;
```

`apps/desktop/vite.config.ts`: add `import { readAppVersion } from './app-version';` and add to the config object:

```ts
  define: { __APP_VERSION__: JSON.stringify(readAppVersion()) },
```

`apps/desktop/vitest.config.ts`: add the same import and the same `define` entry to the `defineProject({...})` object.

`apps/desktop/tsconfig.json`: add `"node"` to `compilerOptions.types`, and `"app-version.ts"` to `include`.

`apps/desktop/src/AboutDialog.tsx`:

```tsx
import { useEffect } from 'react';
import { useStore } from 'zustand';
import type { UiStore } from './ui-store';

export function AboutDialog({ ui }: { ui: UiStore }) {
  const open = useStore(ui, (s) => s.aboutOpen);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') ui.getState().closeAbout();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, ui]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <h2 id="about-title">Data Modelling App</h2>
        <p>Version {__APP_VERSION__}</p>
        <button
          type="button"
          autoFocus
          onClick={() => {
            ui.getState().closeAbout();
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests, run the checks and commit**

Run: `pnpm test apps/desktop && pnpm format && pnpm lint && pnpm typecheck && pnpm --filter desktop build`
Expected: all PASS, and the build succeeds.

```bash
git add apps/desktop
git commit -m "feat(desktop): add About dialog showing the app version

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Native menu adapter

**Files:**

- Create: `apps/desktop/src/menu/native-spec.ts`, `apps/desktop/src/menu/native-menu.ts`
- Modify: `apps/desktop/src-tauri/capabilities/default.json`
- Test: `apps/desktop/src/menu/native-spec.test.ts`

**Interfaces:**

- Consumes: `TopMenu`, `MenuNode` and `MenuEnvironment` (Task 4).
- Produces:
  - `type NativeEntry = { type: 'item'; id; text; enabled; accelerator? } | { type: 'check'; id; text; enabled; checked } | { type: 'submenu'; text; items } | { type: 'separator' } | { type: 'quit' }`
  - `toNativeSpec(menus, env): readonly NativeEntry[]` and `toNativeEntries(nodes): readonly NativeEntry[]`
  - `toAccelerator(shortcut): string | undefined`
  - `useNativeMenu(menus, env, onAction): 'off' | 'pending' | 'active' | 'failed'`
  - `showNativeContextMenu(nodes, onAction): Promise<void>`

- [ ] **Step 1: Write the failing tests**

`apps/desktop/src/menu/native-spec.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { TopMenu } from './menu-model';
import { toAccelerator, toNativeSpec } from './native-spec';

const menus: readonly TopMenu[] = [
  {
    label: 'Edit',
    children: [
      { kind: 'item', id: 'edit.undo', label: 'Undo', shortcut: 'Mod+Z', enabled: true },
      { kind: 'separator' },
      { kind: 'item', id: 'edit.delete', label: 'Delete', shortcut: 'Delete', enabled: false },
    ],
  },
  {
    label: 'View',
    children: [
      { kind: 'item', id: 'view.toolbox', label: 'Toolbox', enabled: true, checked: true },
    ],
  },
  {
    label: 'Help',
    children: [
      { kind: 'item', id: 'help.about', label: 'About Data Modelling App', enabled: true },
    ],
  },
];

describe('toAccelerator', () => {
  it.each([
    ['Mod+Z', 'CmdOrCtrl+Z'],
    ['Mod+Shift+Z', 'CmdOrCtrl+Shift+Z'],
    ['Delete', undefined],
  ])('maps %s to %s', (shortcut, accelerator) => {
    expect(toAccelerator(shortcut)).toBe(accelerator);
  });
});

describe('toNativeSpec', () => {
  it('turns menus into submenus with items, separators and check items', () => {
    expect(toNativeSpec(menus, { isTauri: true, isMac: false })).toEqual([
      {
        type: 'submenu',
        text: 'Edit',
        items: [
          {
            type: 'item',
            id: 'edit.undo',
            text: 'Undo',
            enabled: true,
            accelerator: 'CmdOrCtrl+Z',
          },
          { type: 'separator' },
          { type: 'item', id: 'edit.delete', text: 'Delete', enabled: false },
        ],
      },
      {
        type: 'submenu',
        text: 'View',
        items: [
          { type: 'check', id: 'view.toolbox', text: 'Toolbox', enabled: true, checked: true },
        ],
      },
      {
        type: 'submenu',
        text: 'Help',
        items: [
          { type: 'item', id: 'help.about', text: 'About Data Modelling App', enabled: true },
        ],
      },
    ]);
  });

  it('prepends the macOS app menu with About and Quit', () => {
    const [appMenu] = toNativeSpec(menus, { isTauri: true, isMac: true });

    expect(appMenu).toEqual({
      type: 'submenu',
      text: 'Data Modelling App',
      items: [
        { type: 'item', id: 'help.about', text: 'About Data Modelling App', enabled: true },
        { type: 'separator' },
        { type: 'quit' },
      ],
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test apps/desktop/src/menu/native-spec.test.ts`
Expected: FAIL with `Failed to resolve import "./native-spec"`.

- [ ] **Step 3: Implement the pure translation**

`apps/desktop/src/menu/native-spec.ts`:

```ts
import type { MenuEnvironment, MenuNode, TopMenu } from './menu-model';

export type NativeEntry =
  | {
      readonly type: 'item';
      readonly id: string;
      readonly text: string;
      readonly enabled: boolean;
      readonly accelerator?: string;
    }
  | {
      readonly type: 'check';
      readonly id: string;
      readonly text: string;
      readonly enabled: boolean;
      readonly checked: boolean;
    }
  | { readonly type: 'submenu'; readonly text: string; readonly items: readonly NativeEntry[] }
  | { readonly type: 'separator' }
  | { readonly type: 'quit' };

// Only modifier combinations become native accelerators; a bare key such as Delete would be
// captured by the OS menu and stop working inside text fields.
export function toAccelerator(shortcut: string): string | undefined {
  return shortcut.includes('Mod+') ? shortcut.replace('Mod+', 'CmdOrCtrl+') : undefined;
}

export function toNativeEntries(nodes: readonly MenuNode[]): readonly NativeEntry[] {
  return nodes.map((node): NativeEntry => {
    switch (node.kind) {
      case 'separator':
        return { type: 'separator' };
      case 'submenu':
        return { type: 'submenu', text: node.label, items: toNativeEntries(node.children) };
      case 'item': {
        if (node.checked !== undefined) {
          return {
            type: 'check',
            id: node.id,
            text: node.label,
            enabled: node.enabled,
            checked: node.checked,
          };
        }
        const accelerator = node.shortcut === undefined ? undefined : toAccelerator(node.shortcut);
        return {
          type: 'item',
          id: node.id,
          text: node.label,
          enabled: node.enabled,
          ...(accelerator === undefined ? {} : { accelerator }),
        };
      }
    }
  });
}

export function toNativeSpec(
  menus: readonly TopMenu[],
  env: MenuEnvironment,
): readonly NativeEntry[] {
  const entries = menus.map((menu): NativeEntry => ({
    type: 'submenu',
    text: menu.label,
    items: toNativeEntries(menu.children),
  }));
  if (!env.isMac) return entries;
  const about = menus
    .flatMap((m) => m.children)
    .find((n) => n.kind === 'item' && n.id === 'help.about');
  const appItems: NativeEntry[] = [
    ...(about ? toNativeEntries([about]) : []),
    { type: 'separator' },
    { type: 'quit' },
  ];
  return [{ type: 'submenu', text: 'Data Modelling App', items: appItems }, ...entries];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test apps/desktop/src/menu/native-spec.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the Tauri adapter (verified manually in Task 11)**

`apps/desktop/src/menu/native-menu.ts`:

```ts
import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';
import { useEffect, useEffectEvent, useState } from 'react';
import type { MenuEnvironment, MenuNode, TopMenu } from './menu-model';
import { toNativeEntries, toNativeSpec, type NativeEntry } from './native-spec';

type NativeItem = MenuItem | CheckMenuItem | Submenu | PredefinedMenuItem;
type Handles = Map<string, MenuItem | CheckMenuItem>;

async function build(
  entries: readonly NativeEntry[],
  onAction: (id: string) => void,
  handles: Handles,
): Promise<NativeItem[]> {
  const items: NativeItem[] = [];
  for (const entry of entries) {
    switch (entry.type) {
      case 'separator':
        items.push(await PredefinedMenuItem.new({ item: 'Separator' }));
        break;
      case 'quit':
        items.push(await PredefinedMenuItem.new({ item: 'Quit' }));
        break;
      case 'submenu':
        items.push(
          await Submenu.new({
            text: entry.text,
            items: await build(entry.items, onAction, handles),
          }),
        );
        break;
      case 'check': {
        const check = await CheckMenuItem.new({
          id: entry.id,
          text: entry.text,
          enabled: entry.enabled,
          checked: entry.checked,
          action: onAction,
        });
        handles.set(entry.id, check);
        items.push(check);
        break;
      }
      case 'item': {
        const item = await MenuItem.new({
          id: entry.id,
          text: entry.text,
          enabled: entry.enabled,
          ...(entry.accelerator === undefined ? {} : { accelerator: entry.accelerator }),
          action: onAction,
        });
        handles.set(entry.id, item);
        items.push(item);
        break;
      }
    }
  }
  return items;
}

function flatten(entries: readonly NativeEntry[]): NativeEntry[] {
  return entries.flatMap((e) => (e.type === 'submenu' ? flatten(e.items) : [e]));
}

async function sync(entries: readonly NativeEntry[], handles: Handles): Promise<void> {
  for (const entry of flatten(entries)) {
    if (entry.type !== 'item' && entry.type !== 'check') continue;
    const handle = handles.get(entry.id);
    if (!handle) continue;
    await handle.setEnabled(entry.enabled);
    if (entry.type === 'check' && handle instanceof CheckMenuItem)
      await handle.setChecked(entry.checked);
  }
}

export type NativeMenuState = 'off' | 'pending' | 'active' | 'failed';

// Builds the OS menu once, then only updates enabled and checked states: the menu's
// structure depends on the registry and platform, which never change while the app runs.
export function useNativeMenu(
  menus: readonly TopMenu[],
  env: MenuEnvironment,
  onAction: (id: string) => void,
): NativeMenuState {
  const [state, setState] = useState<NativeMenuState>(env.isTauri ? 'pending' : 'off');
  const [handles] = useState<Handles>(() => new Map());
  const handleAction = useEffectEvent(onAction);
  const spec = toNativeSpec(menus, env);
  const specKey = JSON.stringify(spec);

  useEffect(() => {
    if (!env.isTauri) return;
    let cancelled = false;
    void (async () => {
      try {
        const items = await build(
          toNativeSpec(menus, env),
          (id) => {
            handleAction(id);
          },
          handles,
        );
        const menu = await Menu.new({ items });
        await menu.setAsAppMenu();
        if (!cancelled) setState('active');
      } catch (error) {
        console.error('Native menu unavailable, using the in-window menu instead', error);
        if (!cancelled) setState('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Built once per platform; later changes flow through the sync effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env.isTauri]);

  useEffect(() => {
    if (state !== 'active') return;
    void sync(JSON.parse(specKey) as readonly NativeEntry[], handles);
  }, [state, specKey, handles]);

  return state;
}

export async function showNativeContextMenu(
  nodes: readonly MenuNode[],
  onAction: (id: string) => void,
): Promise<void> {
  const menu = await Menu.new({ items: await build(toNativeEntries(nodes), onAction, new Map()) });
  await menu.popup();
}
```

If the linter rejects the `exhaustive-deps` disable (for example, if the rule name differs in eslint-plugin-react-hooks v7), capture `menus` and `env` in a ref initialised with `useState(() => ({ menus, env }))[0]`, and read from that instead, so the effect's dependency list is complete. Record the choice as a ledger ruling.

`apps/desktop/src-tauri/capabilities/default.json`: change `"permissions"` to:

```json
  "permissions": ["core:default", "core:window:allow-close"]
```

- [ ] **Step 6: Run the checks and commit**

Run: `pnpm test apps/desktop && pnpm format && pnpm lint && pnpm typecheck && (cd apps/desktop/src-tauri && cargo check)`
Expected: all succeed.

```bash
git add apps/desktop
git commit -m "feat(desktop): build the native OS menu from the menu model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Model Explorer right-click menu

**Files:**

- Modify: `apps/desktop/src/ModelExplorer.tsx`, `apps/desktop/src/ModelExplorer.test.tsx`

**Interfaces:**

- Produces: `ModelExplorer(props: PanelProps & { onContextMenu?: (at: { x: number; y: number }) => void })`. Right-click selects the item, then calls `onContextMenu`.

- [ ] **Step 1: Write the failing test**

Add to `apps/desktop/src/ModelExplorer.test.tsx`, inside the `describe`, and import `vi` from `vitest`:

```tsx
it('selects the right-clicked item before asking for a context menu', async () => {
  const fixture = createActionContext();
  const other = addElement(fixture.model, 'core:Package', fixture.modelId, 'Other');
  fixture.ui.getState().select(fixture.modelId);
  const onContextMenu = vi.fn<(at: { x: number; y: number }) => void>(() => {
    expect(fixture.ui.getState().selectedId).toBe(other);
  });
  render(
    <ModelExplorer
      model={fixture.model}
      registry={fixture.registry}
      ui={fixture.ui}
      onContextMenu={onContextMenu}
    />,
  );

  await userEvent
    .setup()
    .pointer({ keys: '[MouseRight]', target: item('Other'), coords: { clientX: 12, clientY: 34 } });

  expect(onContextMenu).toHaveBeenCalledWith({ x: 12, y: 34 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test apps/desktop/src/ModelExplorer.test.tsx`
Expected: FAIL with `expected "spy" to be called with arguments: [ { x: 12, y: 34 } ]`, because right-click does nothing yet.

- [ ] **Step 3: Implement**

In `apps/desktop/src/ModelExplorer.tsx`:

- Change the `ModelExplorer` signature to `export function ModelExplorer({ onContextMenu, ...props }: PanelProps & { readonly onContextMenu?: (at: { x: number; y: number }) => void })`, and pass `onContextMenu={onContextMenu}` through to the root `TreeNode` using the same conditional-spread pattern (`{...(onContextMenu ? { onContextMenu } : {})}`).
- Add the same optional prop to `TreeNode`'s props, and pass it to child `TreeNode`s the same way.
- Add to the `<li>`:

```tsx
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        ui.getState().select(element.id);
        onContextMenu?.({ x: event.clientX, y: event.clientY });
      }}
```

Use `props.model` and `props.registry` where the component previously used the destructured names, or destructure them from `props` after the split.

- [ ] **Step 4: Run the tests, run the checks and commit**

Run: `pnpm test apps/desktop && pnpm format && pnpm lint && pnpm typecheck`
Expected: PASS.

```bash
git add apps/desktop
git commit -m "feat(desktop): open a context menu from the Model Explorer on right-click

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Shell — StarUML layout, native/fallback menus, context menu, About, wiring

**Files:**

- Modify (full rewrite): `apps/desktop/src/Shell.tsx`, `apps/desktop/src/main.tsx`
- Modify: `apps/desktop/src/Shell.test.tsx`, `apps/desktop/src/shell.css`

**Interfaces:**

- Consumes: everything from Tasks 2–9.
- Produces: `Shell({ registry, createModel, platform }: { registry: Registry; createModel: () => Model; platform: Platform })`.

- [ ] **Step 1: Write the failing journey tests**

In `apps/desktop/src/Shell.test.tsx`:

- Change `renderShell` to pass a platform:

```tsx
function renderShell() {
  const registry = Registry.create([umlNotation]);
  const platform = { isTauri: false, isMac: false, exit: () => undefined };
  render(<Shell registry={registry} createModel={() => new Model(registry)} platform={platform} />);
  return userEvent.setup();
}
```

- Add these tests inside `describe('Shell', ...)`:

```tsx
it('lays out Toolbox, canvas, Model Explorer and Properties', () => {
  renderShell();

  const order = [...document.querySelectorAll('.panel-title')].map((h) => h.textContent);
  expect(order).toEqual(['Toolbox', 'Model Explorer', 'Properties']);
  expect(screen.getByText('Open a diagram from the Model Explorer')).toBeInTheDocument();
});

it('adds a class from the Toolbox of the open diagram and undoes it', async () => {
  const user = renderShell();
  await user.click(item('Model'));
  await menu(user, 'Model', 'Add Diagram', 'Class Diagram');
  await user.dblClick(item('New Class Diagram'));

  await user.click(
    within(screen.getByRole('toolbar', { name: 'Toolbox' })).getByRole('button', { name: 'Class' }),
  );
  expect(item('New Class')).toHaveAttribute('aria-selected', 'true');

  await user.click(document.body);
  await user.keyboard('{Control>}z{/Control}');
  expect(screen.queryByRole('treeitem', { name: 'New Class' })).not.toBeInTheDocument();
});

it('adds a package from the right-click menu of a tree item', async () => {
  const user = renderShell();

  await user.pointer({ keys: '[MouseRight]', target: item('Model') });
  const contextMenu = screen.getByRole('menu', { name: 'Context menu' });
  await user.click(within(contextMenu).getByRole('menuitem', { name: 'Add' }));
  await user.click(screen.getByRole('menuitem', { name: 'Package' }));

  expect(item('New Package')).toBeInTheDocument();
});

it('hides and shows panels from the View menu, even both right-hand ones', async () => {
  const user = renderShell();

  await menu(user, 'View', 'Properties');
  await menu(user, 'View', 'Model Explorer');
  expect(screen.queryByRole('tree')).not.toBeInTheDocument();
  expect(screen.queryByText('Nothing selected')).not.toBeInTheDocument();
  expect(screen.getByText('Open a diagram from the Model Explorer')).toBeInTheDocument();

  await menu(user, 'View', 'Model Explorer');
  expect(screen.getByRole('tree')).toBeInTheDocument();
});

it('shows the About dialog from the Help menu', async () => {
  const user = renderShell();

  await menu(user, 'Help', 'About Data Modelling App');

  expect(screen.getByRole('dialog', { name: 'Data Modelling App' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test apps/desktop/src/Shell.test.tsx`
Expected: FAIL. The layout order is still `Model Explorer, Properties`, there's no Toolbox, no context menu and no About, and the View and Help menus don't exist.

- [ ] **Step 3: Implement the shell**

`apps/desktop/src/Shell.tsx` (full replacement):

```tsx
import type { Model } from '@dm/core';
import type { Registry } from '@dm/metamodel';
import { useMemo, useEffect, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useStore } from 'zustand';
import { AboutDialog } from './AboutDialog';
import { allActions, type ActionContext } from './actions';
import { CanvasArea } from './CanvasArea';
import { ContextMenu } from './menu/ContextMenu';
import { buildMenuBar, buildTreeContextMenu, runMenuItem } from './menu/menu-model';
import { showNativeContextMenu, useNativeMenu } from './menu/native-menu';
import { createShortcutLog } from './menu/shortcut-log';
import { MenuBar } from './MenuBar';
import { ModelExplorer } from './ModelExplorer';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import { runTextCommand, type Platform } from './platform';
import { PropertiesPanel } from './PropertiesPanel';
import './shell.css';
import { Toolbox } from './Toolbox';
import { bindToModel, createUiStore, type UiStore } from './ui-store';
import { useModel } from './use-model';
import { useShortcuts } from './use-shortcuts';

interface ShellProps {
  readonly registry: Registry;
  readonly createModel: () => Model;
  readonly platform: Platform;
}

interface Session {
  readonly model: Model;
  readonly ui: UiStore;
}

export function Shell({ registry, createModel, platform }: ShellProps) {
  // Selection and open tabs belong to one model, so a new project replaces both together.
  const [session, setSession] = useState<Session>(() => ({
    model: createModel(),
    ui: createUiStore(),
  }));
  const [shortcutLog] = useState(createShortcutLog);
  const [contextMenuAt, setContextMenuAt] = useState<{ x: number; y: number } | null>(null);
  const { model, ui } = session;
  useEffect(() => bindToModel(ui, model), [ui, model]);
  useModel(model);
  const hidden = useStore(ui, (s) => s.hiddenPanels);
  useStore(ui);

  const ctx = useMemo<ActionContext>(
    () => ({
      model,
      registry,
      ui,
      newProject: () => {
        setSession({ model: createModel(), ui: createUiStore() });
      },
      exit: platform.exit,
      textCommand: runTextCommand,
    }),
    [model, registry, ui, createModel, platform],
  );
  const actions = useMemo(() => allActions(registry), [registry]);
  useShortcuts(actions, ctx, shortcutLog);

  const run = (id: string) => {
    runMenuItem(id, ctx);
  };
  const menus = buildMenuBar(ctx, platform);
  const nativeMenu = useNativeMenu(menus, platform, (id) => {
    if (!shortcutLog.wasJustKeyed(id)) run(id);
  });

  const openContextMenu = (at: { x: number; y: number }) => {
    if (nativeMenu !== 'active') {
      setContextMenuAt(at);
      return;
    }
    showNativeContextMenu(buildTreeContextMenu(ctx), run).catch((error: unknown) => {
      console.error('Native context menu unavailable', error);
      setContextMenuAt(at);
    });
  };

  const panelProps = { model, registry, ui };
  const showExplorer = !hidden.has('explorer');
  const showProperties = !hidden.has('properties');
  return (
    <div className="shell">
      {(nativeMenu === 'off' || nativeMenu === 'failed') && (
        <MenuBar menus={menus} isMac={platform.isMac} onRun={run} />
      )}
      <Group className="shell-body" orientation="horizontal">
        {!hidden.has('toolbox') && (
          <>
            <Panel id="toolbox" defaultSize="15%" minSize="8%">
              <PanelErrorBoundary>
                <Toolbox {...panelProps} />
              </PanelErrorBoundary>
            </Panel>
            <Separator className="resize-handle" />
          </>
        )}
        <Panel id="canvas" minSize="30%">
          <PanelErrorBoundary>
            <CanvasArea {...panelProps} />
          </PanelErrorBoundary>
        </Panel>
        {(showExplorer || showProperties) && (
          <>
            <Separator className="resize-handle" />
            <Panel id="right" defaultSize="25%" minSize="12%">
              <Group orientation="vertical">
                {showExplorer && (
                  <Panel id="explorer" minSize="15%">
                    <PanelErrorBoundary>
                      <ModelExplorer {...panelProps} onContextMenu={openContextMenu} />
                    </PanelErrorBoundary>
                  </Panel>
                )}
                {showExplorer && showProperties && (
                  <Separator className="resize-handle resize-handle-horizontal" />
                )}
                {showProperties && (
                  <Panel id="properties" minSize="15%">
                    <PanelErrorBoundary>
                      <PropertiesPanel {...panelProps} />
                    </PanelErrorBoundary>
                  </Panel>
                )}
              </Group>
            </Panel>
          </>
        )}
      </Group>
      {contextMenuAt && (
        <ContextMenu
          nodes={buildTreeContextMenu(ctx)}
          at={contextMenuAt}
          isMac={platform.isMac}
          onRun={run}
          onClose={() => {
            setContextMenuAt(null);
          }}
        />
      )}
      <AboutDialog ui={ui} />
    </div>
  );
}
```

`apps/desktop/src/main.tsx`: import `detectPlatform` from `./platform`, and render `<Shell registry={registry} createModel={() => new Model(registry)} platform={detectPlatform()} />`.

Append to `apps/desktop/src/shell.css`:

```css
.resize-handle-horizontal {
  width: auto;
  height: 4px;
}

.menu-separator {
  height: 1px;
  margin: 4px 6px;
  background: var(--border);
}

.menu-submenu {
  position: relative;
}

.menu-submenu > .menu-popup {
  top: -5px;
  left: 100%;
}

.menu-check {
  display: inline-block;
  width: 1em;
}

.context-menu {
  position: fixed;
  z-index: 20;
}

.context-menu > .menu-popup {
  position: static;
}

.toolbox-heading {
  margin: 0 10px 6px;
  font-weight: 600;
}

.toolbox-tools {
  display: flex;
  flex-direction: column;
  padding: 0 6px;
}

.toolbox-tool {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border: none;
  border-radius: 4px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
}

.toolbox-tool:hover {
  background: var(--bg-hover);
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 0.35);
}

.dialog {
  min-width: 280px;
  padding: 20px 24px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--fg);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test apps/desktop`
Expected: PASS, including all the earlier Shell journeys.

If react-resizable-panels warns or throws when panels are conditionally removed (for example about layout ids), that's the library's contract: every conditionally rendered `Panel` has a stable `id`, as above. Fix by matching its documented conditional-panel usage in `node_modules/react-resizable-panels/README.md`, not by mocking it.

- [ ] **Step 5: Run the static checks, the boundary check and commit**

Run: `pnpm format && pnpm lint && pnpm typecheck && pnpm depcruise && grep -rn "uml" apps/desktop/src --include=*.ts --include=*.tsx | grep -v -E "\.test\.tsx?:|/testing/|main\.tsx:"`
Expected: all succeed, and the grep prints nothing.

```bash
git add apps/desktop
git commit -m "feat(desktop): adopt StarUML layout with native menus, Toolbox and context menu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Verification, manual check in the real app, pull request

- [ ] **Step 1: Run the whole CI sequence locally**

Run: `pnpm install --frozen-lockfile && pnpm exec prettier --check . '!.superpowers/**' && pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm depcruise && pnpm --filter desktop build && (cd apps/desktop/src-tauri && cargo check)`
Expected: everything succeeds.

- [ ] **Step 2: Manual check in the real app, done with the user**

Run `pnpm --filter desktop tauri dev` and confirm, in order:

1. The native menu bar shows File, Edit, Model, View, Help, and the in-window menu bar is absent.
2. _Model → Add_ is disabled until something is selected. With **Model** selected, _Add → Package_ works.
3. Right-clicking a tree item opens the native context menu.
4. Typing in the Name field and pressing Ctrl+Z undoes the typing only, not the model. Outside a field, Ctrl+Z undoes the model **exactly once**.
5. The View items hide and show panels, with tick marks that follow.
6. The Toolbox adds a Class to the open diagram's package.
7. _Help → About_ shows the version.
8. _File → Exit_ closes the app.

Record the results in the PR description. If item 4 undoes twice or not at all, go back to `ShortcutLog` / `useShortcuts` with a failing test that reproduces the observed delivery order.

- [ ] **Step 3: Push, open the PR and watch CI**

```bash
git push -u origin feat/staruml-layout
gh pr create --base main --title "feat: StarUML-style layout, native menus and toolbox" --body "<summary, manual check results, deliberate refinements, 🤖 footer>"
gh pr checks --watch
```
