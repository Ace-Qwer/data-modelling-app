import { MODEL_KIND, PROJECT_KIND, type ElementKind, type Registry } from '@dm/metamodel';
import { ulid } from 'ulid';
import type { Command, Element } from './types';
import { assertName, assertPropertyValue, defaultsOf } from './validation';

export class Model {
  readonly #registry: Registry;
  readonly #elements = new Map<string, Element>();
  readonly #listeners = new Set<() => void>();
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

  // An arrow function so React's useSyncExternalStore can receive it unbound.
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  execute(command: Command): void {
    this.#apply(command);
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

  #apply(command: Command): void {
    this.#add(command.element);
  }

  #add(element: Element): void {
    const complete = this.#validatedNew(element);
    this.#elements.set(complete.id, complete);
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
