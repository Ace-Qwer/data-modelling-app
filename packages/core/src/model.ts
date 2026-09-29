import {
  MODEL_KIND,
  PROJECT_KIND,
  type ElementKind,
  type PropertyValue,
  type Registry,
} from '@dm/metamodel';
import { ulid } from 'ulid';
import type { Command, Element } from './types';
import { ModelLoadError } from './load-error';
import { assertName, assertPropertyValue, defaultsOf } from './validation';

interface HistoryEntry {
  readonly command: Command;
  readonly inverse: Command;
  readonly revision: number;
}

export class Model {
  readonly #registry: Registry;
  readonly #elements = new Map<string, Element>();
  readonly #listeners = new Set<() => void>();
  readonly #done: HistoryEntry[] = [];
  readonly #undone: HistoryEntry[] = [];
  #rootId: string;
  #version = 0;
  #nextRevision = 1;

  constructor(registry: Registry, createId: () => string = ulid) {
    this.#registry = registry;
    this.#rootId = createId();
    this.#elements.set(this.#rootId, {
      id: this.#rootId,
      kind: PROJECT_KIND,
      name: 'Untitled Project',
      ownerId: null,
      properties: {},
    });
    const modelId = createId();
    this.#elements.set(modelId, {
      id: modelId,
      kind: MODEL_KIND,
      name: 'Model',
      ownerId: this.#rootId,
      properties: {},
    });
  }

  static load(registry: Registry, elements: readonly Element[]): Model {
    const unknown = [
      ...new Set(elements.map((e) => e.kind).filter((k) => !registry.kind(k))),
    ].sort();
    if (unknown.length > 0) {
      throw new ModelLoadError(
        `This project uses element kinds this app doesn't know: ${unknown.join(', ')}.`,
      );
    }
    const roots = elements.filter((e) => e.ownerId === null);
    const [root] = roots;
    if (roots.length !== 1 || root?.kind !== PROJECT_KIND) {
      throw new ModelLoadError(
        'The project file is damaged: it must have exactly one project root.',
      );
    }
    const model = new Model(registry);
    model.#elements.clear();
    model.#elements.set(root.id, root);
    model.#rootId = root.id;
    // Files are written parents first, but hand-edited ones may not be; add whatever is ready each round.
    let pending = elements.filter((e) => e !== root);
    while (pending.length > 0) {
      const ready = pending.filter((e) => e.ownerId !== null && model.#elements.has(e.ownerId));
      const [stuck] = pending;
      if (ready.length === 0 && stuck) {
        throw new ModelLoadError(
          `The project file is damaged: element ${stuck.id} belongs to an element that doesn't exist.`,
        );
      }
      for (const element of ready) {
        try {
          model.#add(element);
        } catch (error) {
          throw new ModelLoadError(
            `The project file is damaged: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      pending = pending.filter((e) => !ready.includes(e));
    }
    return model;
  }

  get root(): Element {
    return this.#require(this.#rootId);
  }

  get version(): number {
    return this.#version;
  }

  get canUndo(): boolean {
    return this.#done.length > 0;
  }

  get canRedo(): boolean {
    return this.#undone.length > 0;
  }

  // Identifies the current point in history, so "unsaved changes" can compare against the saved point.
  get revision(): number {
    return this.#done.at(-1)?.revision ?? 0;
  }

  // An arrow function so React's useSyncExternalStore can receive it unbound.
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  execute(command: Command): void {
    const inverse = this.#apply(command);
    this.#done.push({ command, inverse, revision: this.#nextRevision++ });
    this.#undone.length = 0;
    this.#changed();
  }

  undo(): void {
    const entry = this.#done.pop();
    if (!entry) return;
    this.#apply(entry.inverse);
    this.#undone.push(entry);
    this.#changed();
  }

  redo(): void {
    const entry = this.#undone.pop();
    if (!entry) return;
    this.#done.push({
      command: entry.command,
      inverse: this.#apply(entry.command),
      revision: entry.revision,
    });
    this.#changed();
  }

  getElement(id: string): Element | undefined {
    return this.#elements.get(id);
  }

  children(id: string): readonly Element[] {
    return [...this.#elements.values()].filter((e) => e.ownerId === id);
  }

  elements(): readonly Element[] {
    return [...this.#elements.values()];
  }

  // Returns the command that exactly reverses this one, computed before anything changes.
  #apply(command: Command): Command {
    switch (command.type) {
      case 'AddElement':
        return this.#add(command.element);
      case 'RemoveElement':
        return this.#remove(command.id);
      case 'RestoreElements':
        return this.#restore(command.elements);
      case 'SetName':
        return this.#setName(command.id, command.name);
      case 'SetProperty':
        return this.#setProperty(command.id, command.key, command.value);
    }
  }

  #add(element: Element): Command {
    const complete = this.#validatedNew(element);
    this.#elements.set(complete.id, complete);
    return { type: 'RemoveElement', id: complete.id };
  }

  #remove(id: string): Command {
    const element = this.#require(id);
    if (element.ownerId === null) throw new Error('The project root cannot be removed');
    const subtree = this.#subtree(element);
    for (const removed of subtree) this.#elements.delete(removed.id);
    return { type: 'RestoreElements', elements: subtree };
  }

  #restore(elements: readonly Element[]): Command {
    const [top] = elements;
    if (!top) throw new Error('RestoreElements needs at least one element');
    const restored = new Set<string>();
    try {
      for (const element of elements) {
        if (element !== top && (element.ownerId === null || !restored.has(element.ownerId))) {
          throw new Error(`Restored element ${element.id} is outside the restored subtree`);
        }
        const complete = this.#validatedNew(element);
        this.#elements.set(complete.id, complete);
        restored.add(complete.id);
      }
    } catch (error) {
      for (const id of restored) this.#elements.delete(id);
      throw error;
    }
    return { type: 'RemoveElement', id: top.id };
  }

  #setName(id: string, name: string): Command {
    const element = this.#require(id);
    assertName(name);
    this.#elements.set(id, { ...element, name });
    return { type: 'SetName', id, name: element.name };
  }

  #setProperty(id: string, key: string, value: PropertyValue): Command {
    const element = this.#require(id);
    const definition = assertPropertyValue(this.#kindOf(element.kind), key, value);
    const previous = element.properties[key] ?? definition.default;
    this.#elements.set(id, { ...element, properties: { ...element.properties, [key]: value } });
    return { type: 'SetProperty', id, key, value: previous };
  }

  // Parents come before their children so the result can be restored in order.
  #subtree(top: Element): Element[] {
    const result: Element[] = [];
    const pending = [top];
    for (let next = pending.shift(); next; next = pending.shift()) {
      result.push(next);
      pending.push(...this.children(next.id));
    }
    return result;
  }

  #validatedNew(element: Element): Element {
    if (this.#elements.has(element.id)) throw new Error(`Element ${element.id} already exists`);
    const kind = this.#kindOf(element.kind);
    if (element.ownerId === null) throw new Error('Only the project root may have no owner');
    const owner = this.#require(element.ownerId);
    if (!kind.allowedOwners.includes(owner.kind)) {
      throw new Error(`${kind.id} cannot be owned by ${owner.kind}`);
    }
    assertName(element.name);
    const properties = defaultsOf(kind);
    for (const [key, value] of Object.entries(element.properties)) {
      assertPropertyValue(kind, key, value);
      properties[key] = value;
    }
    return { ...element, properties };
  }

  #kindOf(id: string): ElementKind {
    const kind = this.#registry.kind(id);
    if (!kind) throw new Error(`Unknown kind ${id}`);
    return kind;
  }

  #require(id: string): Element {
    const element = this.#elements.get(id);
    if (!element) throw new Error(`Element ${id} does not exist`);
    return element;
  }

  #changed(): void {
    this.#version += 1;
    for (const listener of this.#listeners) listener();
  }
}
