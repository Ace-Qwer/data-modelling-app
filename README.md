# Schemata

Schemata is a desktop modelling tool for UML, entity–relationship and database design, and other notations such as BPMN, C4 and ArchiMate. It aims to be a fast, open alternative to StarUML and Visual Paradigm. It runs on Windows, macOS and Linux, and is built with TypeScript, React and [Tauri 2](https://tauri.app).

> **Status: early development.** The application shell, model editing and project files work. Drawing on the canvas is in progress.

## Features

Available now:

- **Model Explorer:** a tree of your project's packages, classes and diagrams. Add and delete from the menus or by right-clicking.
- **Properties panel:** edits names and kind-specific properties, such as a class's visibility or whether it's abstract.
- **Undo and redo** for every change, with Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y. Inside text fields they act on the text instead.
- **Project files:** New, Open, Open Recent, Save and Save As, using `.dmproj` files (readable JSON).
  - Saves are atomic, so an interrupted save never damages the previous file.
  - The window title marks unsaved changes with `•`.
  - You're asked before unsaved work is lost.
- **Native menus** on every platform, a Toolbox per diagram type, and panels you can show and hide.

Roadmap:

| Milestone                    | Status                                                          |
| ---------------------------- | --------------------------------------------------------------- |
| App shell, menus and Toolbox | ✅ Done                                                         |
| Save, open and recent files  | ✅ Done                                                         |
| Class diagram shapes (C1)    | 🚧 In progress: place, move, resize, zoom, multi-select, rename |
| Connections (C2)             | Planned: associations, generalisations, dependencies            |
| Export as picture            | Planned                                                         |
| ER modelling, DDL generation | Planned, including reverse engineering from a database          |
| More notations               | Planned: BPMN, C4, ArchiMate, data-flow diagrams                |
| Real-time collaboration      | Designed for (CRDT-ready commands), not started                 |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 22.13 or newer
- [pnpm](https://pnpm.io) 11. The exact version is pinned in `package.json`, so `corepack enable` picks it up.
- [Rust](https://rustup.rs) (stable)
- The Tauri system libraries for your OS ([full list](https://tauri.app/start/prerequisites/)):
  - **Debian/Ubuntu:** `sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf build-essential`
  - **Arch:** `sudo pacman -S --needed --asexplicit webkit2gtk-4.1 base-devel`
  - **macOS:** Xcode Command Line Tools (`xcode-select --install`)
  - **Windows:** Microsoft C++ Build Tools and WebView2 (preinstalled on Windows 10 and 11)

> **Arch tip:** `webkit2gtk-4.1` is the GTK 3 build Tauri needs. `webkitgtk-6.0` does not replace it. Installing it with `--asexplicit` stops `pacman -Rns` clean-ups from removing it as an orphan. If it goes missing, `tauri dev` fails at link time with `unable to find library -lwebkit2gtk-4.1`.

### Run

```bash
pnpm install
pnpm --filter desktop tauri dev
```

The first run compiles the Rust side, which takes a few minutes. After that, the app reloads as you edit the front end.

### Build a release

```bash
pnpm --filter desktop tauri build
```

Installers are written to `apps/desktop/src-tauri/target/release/bundle/`.

## Project layout

```
apps/
  desktop/            Tauri + React app: the only code that touches the DOM, JointJS or Tauri
packages/
  metamodel/          Element kinds, property definitions and the validating Registry
  notation-uml/       The UML notation, as pure data
  core/               Model repository, Commands, undo/redo and validation (pure TypeScript)
  io/                 The .dmproj format: serialise, parse, migrate and load
docs/
  adr/                Architecture decision records
  superpowers/        Design specs and implementation plans per feature
```

### Architecture in brief

- **Every change is a Command.** Commands are serialisable values with ULID ids, applied through one history. This gives undo and redo, unsaved-change tracking and save for free, and keeps the model ready for collaborative editing (CRDT).
- **Notations are data.** A notation declares its element kinds, properties, allowed owners and diagram tools. The `Registry` validates them. The app shell never imports a notation; notations are registered in `apps/desktop/src/main.tsx`. Adding a notation therefore needs no shell changes.
- **Pure core, thin shell.** Everything under `packages/` is plain TypeScript with no UI or platform dependencies, and is tested to at least 90% coverage. `dependency-cruiser` enforces these boundaries.
- **Swappable rendering.** The diagram renderer (JointJS) sits behind an adapter interface so it can be replaced.

See [`docs/adr/`](docs/adr/) for the reasoning behind these choices.

## Development

| Command                           | What it does                      |
| --------------------------------- | --------------------------------- |
| `pnpm test` / `pnpm test:watch`   | Unit and component tests (Vitest) |
| `pnpm test:coverage`              | Tests with coverage               |
| `pnpm lint`                       | ESLint, zero warnings allowed     |
| `pnpm typecheck`                  | TypeScript across all packages    |
| `pnpm format`                     | Prettier                          |
| `pnpm depcruise`                  | Checks package boundaries         |
| `pnpm --filter desktop tauri dev` | Runs the app                      |

How we work:

- **Test-driven development.** Red, green, refactor. Every change starts with a failing test, and every bug fix starts with a test that reproduces it.
- **Comments explain why, never what.** Spec references, constraints and non-obvious trade-offs are welcome. Restating the code is not.
- **Conventional Commits** (`feat(core): …`, `fix(desktop): …`), checked by commitlint. Lefthook runs typecheck, format and lint before each commit.
- **Short-lived branches** (`feat/…`, `fix/…`), squash-merged into `main` once CI is green.
- **Decisions** are recorded as ADRs in `docs/adr/`.

### Adding a notation

1. Create `packages/notation-<name>`, depending only on `@dm/metamodel`.
2. Export a `Notation`: its element kinds, their properties, allowed owners, and the tools each diagram kind offers.
3. Register it in `apps/desktop/src/main.tsx`.

The `Registry` rejects an inconsistent notation at startup, and the shell picks up its kinds, menus and Toolbox automatically.

## License

Schemata is free software: you can redistribute it and/or modify it under the terms of the [GNU General Public License version 3](LICENSE) as published by the Free Software Foundation.

Schemata is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
