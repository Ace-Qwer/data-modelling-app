# Save, Save As, Open and Open Recent — Design

- Date: 2026-09-29
- Status: Draft for review
- Branch: `feat/save-open`
- Part of: sub-project **B** of four (A: layout and menus ✅, B: save/open, C: canvas drawing, D: export as picture)

## Goal

Make work survive closing the app:

- a `.dmproj` project file in readable JSON;
- the standard desktop flow (New, Open…, Open Recent, Save, Save As…, Exit);
- an unsaved-changes prompt wherever work could be lost;
- a window title that shows the file name and whether there are unsaved changes.

## Decisions

| Topic           | Decision                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Extension       | `.dmproj`                                                                                                                              |
| Contents        | One pretty-printed JSON document: format name, format version, the app version that saved it, and the model's elements (parents first) |
| Undo history    | Not saved; an opened project starts with an empty history                                                                              |
| Versioning      | An integer `version` plus step-by-step migrations. Newer versions are refused                                                          |
| Unsaved changes | Tracked by history position (`Model.revision`), so undoing back to the saved state counts as clean                                     |
| Recent projects | The last 10 paths, stored in the app's settings via `@tauri-apps/plugin-store`                                                         |
| File access     | `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs`, scoped to user-picked files plus app data                                     |

## Success criteria

1. _File → Save_ on a new project asks for a location, writes `<name>.dmproj`, and the title becomes `<name>.dmproj — Data Modelling App`. Later Saves write without asking.
2. _File → Save As…_ always asks, and adds `.dmproj` when it's missing.
3. _File → Open…_ shows only `.dmproj` files. It replaces the current project with the loaded one, and clears the selection, open tabs and history.
4. After any edit, the title starts with `• `. Saving, or undoing back to the saved state, removes it.
5. New Project, Open…, Open Recent, Exit and closing the window all prompt **Save / Don't Save / Cancel** when there are unsaved changes, and each button behaves as labelled. Cancel (or cancelling the Save dialog after choosing Save) leaves everything as it was.
6. _File → Open Recent ▸_ lists up to 10 projects, newest first, then _Clear Recently Opened_. A missing file shows "File not found" and is removed from the list.
7. Damaged, foreign or newer files, files with unknown element kinds, and disk errors show a native error message and leave the current project untouched.
8. A save that is interrupted never destroys the previous file: the app writes to `<file>.tmp`, then renames it over the original.

## File format (`packages/io`)

```json
{
  "format": "dmproj",
  "version": 1,
  "savedWith": "0.1.0",
  "elements": [
    {
      "id": "…",
      "kind": "core:Project",
      "name": "Untitled Project",
      "ownerId": null,
      "properties": {}
    }
  ]
}
```

- `serializeProject(model: Model, savedWith: string): string` writes the elements parents first: breadth-first from `model.root`, siblings ordered by id so files diff stably. The output is `JSON.stringify(file, null, 2)` plus a trailing newline.
- `parseProject(text: string): ProjectFile` rejects the following, each with a `ProjectFileError` whose message is suitable for a dialog:
  - text that isn't JSON → "This file is not a Data Modelling project."
  - `format !== 'dmproj'` → the same message
  - `version` that isn't a positive integer → "The project file is damaged."
  - `version` greater than `CURRENT_VERSION` → "This project was saved by a newer version of Data Modelling App."
  - `elements` that isn't an array, or an element missing any of `id`, `kind`, `name`, `ownerId` or `properties`, or with wrongly typed fields → "The project file is damaged."
- `migrate(file)` applies registered steps `v → v+1` until `CURRENT_VERSION`. Version 1 has no steps, but the mechanism and its test exist so that sub-project C can add diagram layout.
- `CURRENT_VERSION = 1`.
- `packages/io` depends on `@dm/core` (for the `Model` and `Element` types) and on nothing UI-related. dependency-cruiser keeps it UI-free (existing rule).

## Core additions (`packages/core`)

- `Model.load(registry, elements, createId?)` is a static constructor. Its errors are `ModelLoadError`s with dialog-ready messages. It:
  - requires exactly one element with `ownerId: null`, of kind `core:Project`;
  - applies each other element through the same validation as `AddElement`, parents first. A file whose parents come after their children is still accepted: `load` sorts topologically, and an element whose owner is missing is rejected.
  - rejects unknown kinds, listed together: "This project uses element kinds this app doesn't know: `x:Foo`, `y:Bar`."
  - leaves the undo history empty and `revision` at its initial value.
- `Model.revision: number` identifies the current history position.
  - Every `execute` assigns a new, unique revision (a monotonic counter) to its history entry.
  - `undo` exposes the revision of the entry now on top, or `0` when the history is empty.
  - `redo` restores the revision of the entry it re-applies.
  - So saving at revision _r_, editing, then undoing returns to _r_, while an edit after an undo never reuses an old revision.

## Desktop (`apps/desktop`)

### Document state

```ts
interface ProjectDocument {
  readonly filePath: string | null; // null until the project is first saved
  readonly savedRevision: number; // model.revision at the last save or load
}
```

- `Session` becomes `{ model, ui, document }`.
- `isDirty(session) = session.model.revision !== session.document.savedRevision`.
- `documentTitle(session)` returns `${isDirty ? '• ' : ''}${fileName ?? 'Untitled'} — Data Modelling App`, where `fileName` is the last path segment.
- The title is applied with `getCurrentWindow().setTitle` in Tauri and `document.title` in the browser.

### Ports

```ts
interface ProjectFiles {
  readonly pickOpenPath: () => Promise<string | null>; // null = cancelled
  readonly pickSavePath: (suggestedName: string) => Promise<string | null>;
  readonly read: (path: string) => Promise<string>;
  readonly writeAtomically: (path: string, text: string) => Promise<void>;
  readonly exists: (path: string) => Promise<boolean>;
  readonly confirmDiscard: (documentName: string) => Promise<'save' | 'discard' | 'cancel'>;
  readonly showError: (title: string, message: string) => Promise<void>;
}

interface RecentProjects {
  readonly list: () => Promise<readonly string[]>;
  readonly add: (path: string) => Promise<readonly string[]>; // moves to front, caps at 10
  readonly remove: (path: string) => Promise<readonly string[]>;
  readonly clear: () => Promise<void>;
}
```

- **Tauri implementations** (`files/tauri-files.ts`, `files/tauri-recent.ts`) use:
  - `open` / `save` from `@tauri-apps/plugin-dialog`, filtered to `{ name: 'Data Modelling Project', extensions: ['dmproj'] }`;
  - `readTextFile`, `writeTextFile`, `rename` and `exists` from `@tauri-apps/plugin-fs`;
  - `message` with buttons `{ yes: 'Save', no: "Don't Save", cancel: 'Cancel' }` for `confirmDiscard`;
  - a `LazyStore('settings.json')`, key `recentProjects`, for the recent list.
- **In-memory implementations** (`files/memory-files.ts`) serve the tests and the browser dev fallback. In the browser, the file menu items are disabled instead (`platform.isTauri === false`).
- `pickSavePath` results without `.dmproj` get the extension appended by the document flow, not by the port.

### Document flow (`files/document-flow.ts`)

These are pure async functions over `(session, ports, registry, appVersion)`, returning a new session or `null` when cancelled:

- **`save(session)`**
  1. With no `filePath`, delegate to `saveAs`.
  2. Otherwise serialize and `writeAtomically`.
  3. Return a session whose `savedRevision` is `model.revision`, and add the path to recents.
- **`saveAs(session)`**: `pickSavePath(<current name or 'Untitled'>.dmproj)`. On cancel, return `null`. Otherwise ensure the extension, then write as in `save`, updating `filePath`.
- **`guardUnsaved(session)`**:
  - If the session isn't dirty, return `'proceed'`.
  - Otherwise `confirmDiscard`:
    - _save_: `save`, then `'proceed'` if the save completed, or `'cancel'` if it was cancelled or failed.
    - _discard_: `'proceed'`.
    - _cancel_: `'cancel'`.
- **`newProject(session)`**: `guardUnsaved`, then a fresh session with `filePath: null`.
- **`openPath(session, path)`**: `guardUnsaved`, then `read` → `parseProject` → `migrate` → `Model.load`.
  - Any error: `showError`, and the current session is returned unchanged.
  - A path that no longer exists: "File not found", and the path is removed from recents.
  - Success: a new session (fresh UI store, `savedRevision = model.revision`), and the path is added to recents.
- **`open(session)`**: `pickOpenPath`, then `openPath`.
- **`exit(session)`**: `guardUnsaved`, then `platform.exit()`. In Tauri, `exit` calls `getCurrentWindow().destroy()`, which bypasses the close-requested hook, so the user is never asked twice.

### Actions and menus

- `file.new` (`Mod+N`), `file.open` (`Mod+O`), `file.save` (`Mod+S`), `file.saveAs` (`Mod+Shift+S`) and `file.exit` run the flows above. They're enabled only in Tauri, except `file.new`, which is always enabled.
- The File menu reads: New Project, Open…, Open Recent ▸, separator, Save, Save As…, separator, Exit (Exit on Windows/Linux only).
- _Open Recent_ is a submenu built from the recent list (item ids `file.openRecent:<index>`, labels showing the file name with the folder in parentheses), then a separator and `file.clearRecent` (_Clear Recently Opened_). The submenu is disabled when the list is empty. Because its items change, the native menu is rebuilt when the recent list changes (the only structural change in the menu).
- `ActionContext` gains the async flow runners. Actions stay synchronous and start the flow with `void`. Errors inside flows are shown through `showError`, never thrown into React.

### Window close

- In Tauri, `getCurrentWindow().onCloseRequested` always calls `event.preventDefault()` and runs the `exit` flow. That flow prompts only when the session is dirty, then destroys the window.
- Because `destroy()` doesn't fire the close request again, there's no second prompt.
- This needs the `core:window:allow-destroy` permission.

### Permissions (`capabilities/default.json`)

`dialog:default`, `fs:allow-read-text-file`, `fs:allow-write-text-file`, `fs:allow-rename`, `fs:allow-exists`, `store:default`, `core:window:allow-set-title`, `core:window:allow-destroy`.

- The fs read/write/rename/exists permissions are scoped to the glob patterns `**/*.dmproj` and `**/*.dmproj.tmp`, so the app can touch project files (and their temp siblings) on any drive, and nothing else.
- The settings store lives in `$APPDATA` through the store plugin's own permission.

## Error handling

- Every failure path goes through `ProjectFiles.showError` with a human sentence. The session is never replaced by a half-loaded model.
- Save errors (disk full, permission denied) keep the document dirty and leave the original file intact, thanks to the temp-file-then-rename write.

## Testing

- **io:**
  - round trip;
  - parents-first order and a stable element order;
  - each `parseProject` rejection;
  - `migrate` applies steps in order (tested with a fake v0→v1 step injected through the step table);
  - a newer version is refused;
  - property test: a random edit sequence serialises and loads back to an identical model.
- **core:**
  - `Model.load` accepts a valid set in any order;
  - it rejects a missing, duplicate or wrongly kinded root, unknown kinds (listed together), orphans and invalid properties;
  - `revision` behaviour through execute, undo and redo, including "edit after undo never reuses an old revision".
- **Desktop document flow**, with the in-memory ports:
  - every path in the flow section, including Save chosen in the prompt followed by cancelling the Save dialog;
  - open errors leave the session untouched;
  - the recents list is ordered, capped, de-duplicated, drops missing files and can be cleared.
- **Desktop UI:**
  - the title text follows saving, editing and undo (browser `document.title`);
  - the File menu structure and enablement;
  - the Open Recent submenu contents.
- **Manual check in the real app** (with the user):
  - the native Open and Save dialogs and the `.dmproj` filter;
  - Save / Don't Save / Cancel on New, Open, Exit and the window ✕;
  - Open Recent across restarts;
  - a saved file reopens identically and reads as tidy JSON.

## Out of scope

Save as picture (D), autosave and crash recovery, multiple windows, OS file associations (double-click to open), diagram layout in the file (arrives with C via migration), and saving UI state (open tabs, panel layout).
