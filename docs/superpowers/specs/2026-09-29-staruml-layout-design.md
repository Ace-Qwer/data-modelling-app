# StarUML-style Layout, Native Menus and Toolbox — Design

- Date: 2026-09-29
- Status: Draft for review
- Branch: `feat/staruml-layout`
- Part of: sub-project **A** of four (A: layout and menus, B: save/open, C: canvas drawing, D: export as picture)

## Goal

Make the app look and work like StarUML:

- a native OS menu bar with StarUML's menu structure;
- a Toolbox on the left, the canvas in the middle, and the Model Explorer above the Properties panel on the right;
- adding elements moved from a top-level _Add_ menu into _Model → Add_, the Toolbox, and a right-click menu in the Model Explorer.

## Decisions

| Topic               | Decision                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Menu kind           | Native OS menu via Tauri's menu API. In a plain browser and in tests, the existing in-window menu bar renders the same menu model |
| Unfinished features | Menus show only working items. Format and Tools menus arrive with the canvas (C)                                                  |
| Toolbox in A        | Working: clicking a tool adds the element to the open diagram's package. In C, tools switch to placing on the canvas              |
| Panel layout memory | Not persisted between runs (YAGNI)                                                                                                |

## Success criteria

1. The window's native menu bar reads **File, Edit, Model, View, Help**. On macOS there's also the standard app menu with About and Quit.
2. There is no top-level _Add_ menu. _Model → Add ▸_ lists element and package kinds, and _Model → Add Diagram ▸_ lists diagram kinds. Both come from the registry and are enabled per selection.
3. The layout is Toolbox | canvas | (Model Explorer above Properties). Each panel can be hidden and shown with a tick-box item in _View_.
4. With a Class Diagram tab active, the Toolbox shows **Class** and **Package**. Clicking one adds "New Class" or "New Package" to the diagram's owning package, selects it, and creates one undo step.
5. Right-clicking a Model Explorer item selects it and opens a native context menu with **Add ▸**, **Add Diagram ▸** and **Delete**.
6. Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y undo and redo the _text_ while a text field has focus, and the _model_ otherwise. Delete edits text inside fields and deletes the selection elsewhere.
7. _Help → About_ shows the app name and version.
8. The shell still never references a notation (dependency-cruiser rule unchanged).

## Metamodel changes (`packages/metamodel`)

- `ElementKind` gains an optional `tools?: readonly string[]`. It's meaningful only for `category: 'diagram'` kinds.
- `Registry.create` additionally rejects:
  - `tools` on a non-diagram kind;
  - a tool naming an unknown kind;
  - a tool whose kind can't be owned by at least one of the diagram kind's `allowedOwners`.

  A tool's element is created in the diagram's owner, so it must be able to live there.

- `notation-uml`: `uml:ClassDiagram` gets `tools: ['uml:Class', 'core:Package']`.

## Actions (`apps/desktop/src/actions.ts`)

- `addActions(registry)` splits into:
  - `addElementActions(registry)`: every kind except `core:Project` and diagram kinds, ids `add.<kindId>`;
  - `addDiagramActions(registry)`: diagram kinds, ids `add.<kindId>`.

  Both keep the existing enable rule (the selection may own the kind).

- `edit.delete` protects the Project root and **only the last remaining** `core:Model`. A second, user-added Model can be deleted. This resolves a deferred review finding.
- New actions:
  - `view.toolbox`, `view.explorer`, `view.properties`: toggle panel visibility. They have a `checked(ctx)` state.
  - `help.about`: opens the About dialog.
  - `file.exit`: closes the window. It's shown only when running in Tauri; on macOS it becomes the predefined Quit item in the app menu.
- `Action` gains an optional `checked?(ctx): boolean`.
- `file.open` and `file.save` are removed from the menus until sub-project B.
- Tool clicks reuse the add logic: `addElement(ctx, kind, ownerId)` is extracted from the Add actions and shared by both.

## Menu model (`apps/desktop/src/menu/menu-model.ts`)

This is a pure function, with no React and no Tauri:

```ts
type MenuNode =
  | { kind: 'item'; id: string; label: string; shortcut?: string; enabled: boolean; checked?: boolean }
  | { kind: 'submenu'; label: string; children: readonly MenuNode[] }
  | { kind: 'separator' };

interface MenuEnvironment { isTauri: boolean; isMac: boolean }

buildMenuBar(ctx, registry, env: MenuEnvironment): readonly { label: string; children: readonly MenuNode[] }[]
buildTreeContextMenu(ctx, registry): readonly MenuNode[]
```

Structure:

| Menu  | Contents                                                                |
| ----- | ----------------------------------------------------------------------- |
| File  | New Project, then a separator and Exit when `env.isTauri && !env.isMac` |
| Edit  | Undo, Redo, separator, Delete                                           |
| Model | Add ▸ (addElementActions), Add Diagram ▸ (addDiagramActions)            |
| View  | Toolbox ☑, Model Explorer ☑, Properties ☑                               |
| Help  | About Data Modelling App                                                |

- On macOS in Tauri, the native renderer prepends the standard app menu (About Data Modelling App → `help.about`, separator, predefined Quit). Exit is then omitted from File.
- Only the first shortcut is shown as a menu item's shortcut. Redo still responds to both.
- `runMenuItem(id, ctx)` looks the action up by id and runs it if it's enabled.

## Renderers

- **Native (`menu/native-menu.ts`)**, used when `isTauri()` from `@tauri-apps/api/core` is true:
  - It converts the menu model into `Menu`/`Submenu`/`MenuItem`/`CheckMenuItem`/`PredefinedMenuItem` and calls `setAsAppMenu()`.
  - It subscribes to the model and the UI store, and on every change updates `setEnabled` / `setChecked` on existing items. It rebuilds only when the _structure_ changes.
  - A pure translation step (`toNativeSpec(menuModel, isMac)`) produces the option objects and is unit-tested. The Tauri calls around it are verified by hand.
- **Native shortcut registration:**
  - `Mod+Z`, `Mod+Shift+Z` and `Mod+Y` are registered as native accelerators (`CmdOrCtrl+…`).
  - `Delete` is **not** registered natively, so it keeps working inside text fields. The native item is labelled just "Delete", with no accelerator.
  - The in-app keyboard handler (`useShortcuts`) keeps handling `Delete`, and in the browser fallback it handles all shortcuts.
- **Undo/redo routing:**
  - The handler for `edit.undo` / `edit.redo` first checks `document.activeElement`.
  - If it's a text-entry element (existing `isTextEntryTarget`), it performs the field's own undo/redo via `document.execCommand('undo' | 'redo')` and leaves the model alone.
  - Otherwise it undoes or redoes the model.
- **In-window (`MenuBar.tsx`):** the existing component renders `buildMenuBar` output, including submenus, separators and checked marks. It's used when not running in Tauri, and as the fallback if building the native menu throws (the error is logged).
- **Tree context menu:**
  - In Tauri, `Menu.new(...)` + `popup()` at the pointer.
  - In the browser fallback, an in-window popup built from the same `buildTreeContextMenu` model, reusing the menu-popup styling.

## Layout (`Shell.tsx`)

```
Group(horizontal)
├─ Panel "toolbox"      (default 15%, collapsible)
├─ Separator
├─ Panel "canvas"       (min 30%)
├─ Separator
└─ Panel "right"        (default 25%)
   └─ Group(vertical)
      ├─ Panel "explorer"   (default 50%, collapsible)
      ├─ Separator
      └─ Panel "properties" (default 50%, collapsible)
```

- Panel visibility lives in the UI store: `hiddenPanels: ReadonlySet<'toolbox' | 'explorer' | 'properties'>` and `togglePanel(name)`.
- A hidden panel isn't rendered.
- If both right-hand panels are hidden, the right column isn't rendered either.

## Toolbox (`Toolbox.tsx`)

- It reads the active diagram from the UI store and looks up its kind's `tools`.
- It renders a heading with the diagram kind's label, then one button per tool: the icon (`KindIcon`) and the kind label.
- Clicking a tool calls `addElement(ctx, toolKindId, diagram.ownerId)`.
- With no active diagram, it shows "Open a diagram to see its tools".

## About (`AboutDialog.tsx`)

- A modal `<dialog>` with the app name, the version, and a Close button. Escape also closes it.
- The version comes from Vite `define` (`__APP_VERSION__`, read from `apps/desktop/package.json`), so it works in both the browser and Tauri.
- Whether it's open lives in the UI store (`aboutOpen`).

## Error handling

- If building the native menu throws (for example, a missing permission), the error is logged to the console and the in-window menu bar is rendered instead.
- A tool that can't be placed is impossible after registry validation. `addElement` still goes through the model's own validation, which would throw, and the panel error boundary would catch it.

## Testing

- **metamodel:** the three new rejection rules, and a valid `tools` declaration.
- **notation-uml:** the Class Diagram's tools pass validation.
- **Menu model:**
  - The top-level labels are exactly `File, Edit, Model, View, Help`.
  - Add and Add Diagram children come from the registry.
  - Enabled states follow the selection.
  - View items are checked or unchecked according to the hidden panels.
  - Exit is present only for `{ isTauri: true, isMac: false }`.
- **Native translation:** `toNativeSpec` maps shortcuts to `CmdOrCtrl+…` accelerators, omits the Delete accelerator, uses a check item for View entries, and uses predefined Quit/About on macOS.
- **Undo routing:** with a focused text field, `edit.undo` doesn't change the model. Without one, it undoes the model.
- **Components** (React Testing Library, real Model and Registry): Toolbox, in-window MenuBar with submenus and check marks, tree context menu (browser fallback), About dialog, and panel hiding.
- **Shell journeys:**
  - Open a class diagram → click the Class tool → "New Class" appears under the diagram's package, selected → rename → Ctrl+Z reverts.
  - Right-click the Model → Add → Package.
  - View → hide Properties → the panel is gone → show it again.
- **Manual check in the real app** (recorded in the PR): native menu structure, enabled-state updates, the right-click popup, and Ctrl+Z inside a text field versus outside.
- **Spike first:** the plan's first task checks on Linux that native accelerators behave as assumed (whether they fire while a text field has focus, and whether the webview still receives the key). The routing design adapts if they don't.

## Out of scope

Save/Open (B), canvas drawing and the Format/Tools menus (C), picture export (D), remembering the panel layout, dragging from the Toolbox, keyboard navigation in the tree, and the other deferred review follow-ups.
