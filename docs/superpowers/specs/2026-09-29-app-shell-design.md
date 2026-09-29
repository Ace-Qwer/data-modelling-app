# App Shell and Notation Plugin System — Design

- Date: 2026-09-29
- Status: Draft for review
- Branch: `feat/app-shell`

## Goal

Lay the foundation every diagram type builds on: a menu bar, a model tree, a canvas area and a properties panel, all driven by a notation plugin system. Adding a notation later (UML sequence, ER, BPMN, C4, …) must mean adding a package, not editing the shell.

## Decisions

| Topic                  | Decision                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Model organisation     | StarUML-style: Project → Model → packages; elements and diagrams live inside packages; diagrams are views onto elements |
| Persistence            | Out of scope. The model is in memory only; File > Open and Save are shown disabled                                      |
| Content this milestone | Core packages plus a stub UML notation (Class Diagram, Class)                                                           |
| Plugin mechanism       | Declarative contributions: notations are pure-TypeScript data packages read by a registry                               |
| Menu bar               | Rendered in-window by React (not a native OS menu)                                                                      |

## Success criteria

1. A new project shows `Project → Model` in the Model Explorer.
2. With the Model or a Package selected, _Add → Package / Class / Class Diagram_ creates the element under it. Invalid Add items are disabled.
3. Selecting an element shows its kind, name and notation-defined properties in the Properties panel; edits apply immediately and each is one undo step.
4. Undo/redo (menu and keyboard) reverts and reapplies every change, including deleting a package with its contents.
5. Double-clicking a diagram opens it in a canvas tab; deleting the diagram (or an ancestor) closes the tab.
6. The shell source contains no reference to `uml:` or any other notation; `notation-uml` is registered only in `apps/desktop/src/main.tsx`.

## Packages

```
packages/metamodel       ElementKind, PropertyDefinition, Notation, Registry, built-in core notation
packages/notation-uml    uml:ClassDiagram, uml:Class           (depends on metamodel only)
packages/core            Model, commands, history, validation  (depends on metamodel)
apps/desktop             shell UI; registers notations at startup
```

Allowed dependencies: `metamodel` ← `notation-*`, `metamodel` ← `core`, and `apps/desktop` → all. `notation-*` must not depend on `core`, and no `packages/*` may import UI code. dependency-cruiser enforces both rules.

## Metamodel (`packages/metamodel`)

```ts
type PropertyValue = string | boolean;

type PropertyDefinition =
  | { key: string; label: string; type: 'string' | 'text'; default: string }
  | { key: string; label: string; type: 'boolean'; default: boolean }
  | { key: string; label: string; type: 'enum'; options: readonly string[]; default: string };

interface ElementKind {
  id: string; // namespaced, e.g. 'uml:Class'
  label: string; // 'Class'
  icon: string; // icon id resolved by the desktop app
  category: 'package' | 'diagram' | 'element';
  allowedOwners: readonly string[]; // kind ids that may own this kind
  properties: readonly PropertyDefinition[];
}

interface Notation {
  id: string; // 'uml'
  label: string; // 'UML'
  kinds: readonly ElementKind[];
}
```

`Registry`:

- `Registry.create(notations)` is the only way to build one. It always includes the built-in core notation, validates everything together, and throws if:
  - a kind id is registered twice;
  - a kind id isn't prefixed with its notation id (`uml:` for `uml`);
  - an `allowedOwners` entry names an unknown kind (so notations may reference each other's kinds);
  - a property key appears twice within one kind;
  - an enum default is not among its options.
- Queries: `kind(id)`, `kinds()` and `kindsAllowedUnder(ownerKindId)`.

Built-in core notation (always registered):

- `core:Project`: the root; allowed under nothing.
- `core:Model`: allowed under `core:Project`.
- `core:Package`: allowed under `core:Model` and `core:Package`.

## UML stub notation (`packages/notation-uml`)

- `uml:ClassDiagram`: category `diagram`, allowed under `core:Model` and `core:Package`, no properties.
- `uml:Class`: category `element`, allowed under `core:Model` and `core:Package`, with properties:
  - `isAbstract`: boolean, default `false`
  - `visibility`: enum `public | package | protected | private`, default `public`

## Core model (`packages/core`)

```ts
interface Element {
  id: string; // ULID
  kind: string;
  name: string;
  ownerId: string | null; // null only for the Project root
  properties: Readonly<Record<string, PropertyValue>>;
}

type Command =
  | { type: 'AddElement'; element: Element }
  | { type: 'RestoreElements'; elements: readonly Element[] } // inverse of RemoveElement: a subtree, parents first
  | { type: 'RemoveElement'; id: string }
  | { type: 'SetName'; id: string; name: string }
  | { type: 'SetProperty'; id: string; key: string; value: PropertyValue };
```

- `new Model(registry)` creates a `core:Project` root named "Untitled Project" and a `core:Model` child named "Model".
- `AddElement` fills in defaults for any property the element omits.
- `execute(command)` validates, applies, pushes `{ command, inverse }` to the undo stack, clears the redo stack and notifies subscribers. Inverses are computed at execution time:
  - `AddElement` → `RemoveElement`
  - `RemoveElement` → `RestoreElements` (the removed subtree)
  - `SetName` → `SetName` with the previous name
  - `SetProperty` → `SetProperty` with the previous value
- Validation. An invalid command throws and leaves the model unchanged if:
  - the id is unknown or duplicated;
  - the owner is missing, or its kind doesn't allow the child kind;
  - the element's kind is unknown;
  - a property key is not defined, or its value has the wrong type or an enum value outside the options;
  - the command would remove the Project root;
  - a name is empty after trimming.
- Queries: `root`, `getElement(id)`, `children(id)` (unordered; the UI sorts), `elements()`, `canUndo`, `canRedo`.
- `subscribe(listener): unsubscribe`. Listeners run after every `execute`, `undo` and `redo`. A `version` counter increments on every change so that React's `useSyncExternalStore` gets a cheap snapshot.
- Children are always derived from `ownerId`. No element stores a list of child ids.

## Desktop shell (`apps/desktop`)

### Layout

```
┌────────────────────────────────────────────────────────────┐
│ File  Edit  Add                                            │
├──────────────┬──────────────────────────────┬──────────────┤
│ Model        │ [Overview ×] [Schema ×]      │ Properties   │
│ Explorer     │                              │              │
│              │        canvas (grid)         │              │
└──────────────┴──────────────────────────────┴──────────────┘
```

Side panels are resizable with drag handles.

### Actions

```ts
interface Action {
  id: string;
  label: string;
  shortcut?: string; // e.g. 'Mod+Z'
  isEnabled(ctx: ActionContext): boolean;
  run(ctx: ActionContext): void;
}
// ActionContext = { model, registry, ui } where ui is the UI store
```

- The menu bar and the keyboard handler read from the same action registry.
- Built-in actions:
  - File: `file.new`; `file.open` and `file.save` are always disabled.
  - Edit: `edit.undo`, `edit.redo`, `edit.delete`. Delete is disabled for the Project root and the Model.
- The Add menu is generated from the registry: one `add.<kindId>` action per registered kind except `core:Project`, enabled only when the selected element's kind is among that kind's `allowedOwners`. With nothing selected, all Add items are disabled. New elements get a ULID and a default name of `New <Label>` (e.g. "New Class") and are selected after creation.
- Shortcuts:
  - `Mod+Z`: undo
  - `Mod+Shift+Z` and `Mod+Y`: redo
  - `Delete`: delete the selection

  `Mod` is Ctrl, or Cmd on macOS. Shortcuts are ignored while focus is in a text input.

### UI store (Zustand)

`{ selectedId, openDiagramIds, activeDiagramId }` and actions to change them. After every model change, the store drops a `selectedId` or open-diagram id that no longer exists.

### Model Explorer

- The tree is built from `children(id)`. Within each owner, the order is packages, then diagrams, then elements, each alphabetical by name.
- Expand/collapse per node; the root and the Model start expanded.
- The icon comes from the kind's `icon` id, mapped to an icon component in the desktop app, with a generic fallback icon.
- Click selects the element; double-clicking a `diagram` opens its tab.

### Properties panel

- With nothing selected, the panel shows "Nothing selected".
- Otherwise it shows:
  - the kind's label (read-only);
  - **Name** (text);
  - one editor per `PropertyDefinition`:
    - `string` → text input
    - `text` → textarea
    - `boolean` → checkbox
    - `enum` → dropdown
- Text fields commit on Enter or blur. Escape reverts and doesn't commit. Checkboxes and dropdowns commit immediately.
- An empty name reverts the field and sends nothing to the model.
- Commits that don't change the value are skipped, so they create no undo steps.
- The editor per property type comes from a lookup table, so a custom editor (e.g. multiplicity) can be registered later without touching the panel.

### Canvas area

- Tabs for open diagrams show the diagram name and a × button.
- The active tab shows an empty grid surface with a `data-diagram-id`. This is the mount point for the renderer contribution in a later milestone.
- With no diagram open, the area shows "Open a diagram from the Model Explorer".

### Wiring

- `main.tsx` creates `Registry.create([uml])` and `new Model(registry)` and renders `<Shell model registry />`.
- `useModel(model)` wraps `useSyncExternalStore(model.subscribe, () => model.version)`.

## Error handling

- Invalid commands throw. Because the UI offers only valid actions, a throw is a programming error. A React error boundary around each panel shows "Something went wrong in this panel" instead of blanking the app.
- Registry errors happen at startup.
- Rejected name edits revert locally without reaching the model.

## Testing

- **metamodel:** each registry rejection rule; `kindsAllowedUnder`; the core notation's containment.
- **notation-uml:** registers with the core notation; Class can be placed under Model and Package; Class defaults.
- **core:**
  - each command, its validation and its inverse;
  - notifications to subscribers;
  - property test: any random valid command sequence, fully undone, returns the exact initial `elements()`;
  - property test: the same sequence replays identically after a JSON round-trip.
- **desktop** (React Testing Library with the real `Model` and `Registry`; no mocks):
  - menu enablement follows the selection;
  - Add creates and selects the element;
  - tree sorting and icons;
  - the properties panel's editors and commit/revert behaviour;
  - shortcuts are ignored inside inputs;
  - tabs open and close, and close automatically on delete, including a delete of an ancestor package;
  - user journey: select Model → Add Package → rename it in Properties → `Mod+Z` restores "New Package".
- **Coverage:** at least 90% for `packages/**` (already enforced).
- **Out of scope:** E2E through tauri-driver is the next follow-up.

## Out of scope

Saving and opening files, drawing on the canvas, right-click menus, rename in the tree, drag-and-drop, a status bar, themes, a native OS menu, and E2E tests.
