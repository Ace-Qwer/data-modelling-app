# ADR-0001: TypeScript + Tauri as the application stack

- Status: Accepted
- Date: 2026-09-28

## Context

We are building a desktop modelling tool to compete with StarUML and Visual Paradigm. It needs the full UML suite, ER modelling with DDL generation and reverse engineering, and other notations (BPMN, C4, ArchiMate, DFD). It starts single-user, but real-time collaboration must be possible later without a rewrite. Development is strictly test-driven.

## Options considered

- **TypeScript (Tauri/Electron):** the richest diagramming ecosystem (JointJS, ELK.js), the most mature CRDT libraries (Yjs, Automerge), fast TDD tooling (Vitest, Playwright). StarUML is built this way.
- **Rust native GUI:** excellent performance, but GUI toolkits (egui, Iced, Slint) are immature for rich diagram editors.
- **Java/Kotlin (JavaFX):** the deepest modelling ecosystem (EMF, UML2, XMI), but slower UI iteration and few CRDT options.
- **C# (Avalonia):** strong tooling, but few open diagramming libraries and weak CRDT support.

## Decision

TypeScript with React + Vite for the UI, packaged with Tauri 2. The domain logic lives in pure TypeScript packages with no DOM or Tauri dependencies. Rust is limited to thin native glue, and later to profiled hot paths.

## Consequences

- Much smaller binaries and memory use than Electron. Linux builds need system WebKitGTK.
- JointJS is wrapped behind our own renderer adapter so it can be replaced.
- All mutations go through serialisable Commands with ULID ids, so a CRDT sync layer can be added later.
- TypeScript is pinned to `~6.0` until typescript-eslint supports TypeScript 7 (its peer range is `<6.1` as of 2026-09).
