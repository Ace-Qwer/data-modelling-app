# Data Modelling App

Desktop modelling tool (UML, ER/database, BPMN, C4, …) built with TypeScript + Tauri 2. See `docs/adr/` for decisions.

## Non-negotiables
- **TDD:** red → green → refactor. No production code without a failing test that demands it. Bug fixes start with a reproducing test.
- **Comments explain why, never what.** Allowed: constraints, spec references (e.g. "UML 2.5.1 §11.5"), non-obvious trade-offs, TSDoc on public package APIs. Not allowed: restating code or names, commented-out code, changelog notes.
- **Code management:** Conventional Commits (`feat(core): …`), short-lived `feat/…`/`fix/…` branches squash-merged into `main`, CI must be green. Record architectural decisions as ADRs in `docs/adr/`.

## Layout
- `packages/metamodel`: notation-agnostic metamodel plus notation definitions
- `packages/core`: model repository, Commands, undo/redo, validation (pure TS)
- `packages/diagram`: view model (shapes, bounds, waypoints), kept separate from semantics
- `packages/io`: project file format, migrations, DDL, XMI
- `apps/desktop`: Tauri + React; the **only** place allowed to touch the DOM, JointJS or Tauri APIs

## Rules
- Every model mutation is a serialisable `Command`. Ids are ULIDs. Never reference elements by array position; this keeps the model ready for CRDT collaboration.
- `dependency-cruiser` enforces the package boundaries. Don't bypass it.

## Commands
- `pnpm test` / `pnpm test:watch`: Vitest
- `pnpm lint`, `pnpm typecheck`, `pnpm depcruise`
- `pnpm --filter desktop tauri dev`: run the app
