import { MODEL_KIND, PROJECT_KIND, type ElementKind, type Registry } from '@dm/metamodel';
import { ulid } from 'ulid';
import type { Command, Element } from './types';
import { assertName, assertPropertyValue, defaultsOf } from './validation';

interface HistoryEntry {
  readonly command: Command;
  readonly inverse: Command;
}

export class Model {
  readonly #registry: Registry;
  readonly #elements = new Map<string, Element>();
  readonly #listeners = new Set<() => void>();
  readonly #done: HistoryEntry[] = [];
  readonly #undone: HistoryEntry[] = [];
  readonly #rootId: string;
  #version = 0;

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

  // An arrow function so React's useSyncExternalStore can receive it unbound.
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  execute(command: Command): void {
    const inverse = this.#apply(command);
    this.#done.push({ command, inverse });
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
    this.#done.push({ command: entry.command, inverse: this.#apply(entry.command) });
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
