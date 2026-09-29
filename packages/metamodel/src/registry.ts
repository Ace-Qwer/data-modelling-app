import { coreNotation } from './core-notation';
import type { ElementKind, Notation } from './types';

export class Registry {
  readonly #kinds: ReadonlyMap<string, ElementKind>;

  private constructor(kinds: ReadonlyMap<string, ElementKind>) {
    this.#kinds = kinds;
  }

  static create(notations: readonly Notation[]): Registry {
    const kinds = new Map<string, ElementKind>();
    for (const notation of [coreNotation, ...notations]) {
      for (const kind of notation.kinds) {
        if (!kind.id.startsWith(`${notation.id}:`)) {
          throw new Error(`Kind ${kind.id} must be prefixed with "${notation.id}:"`);
        }
        if (kinds.has(kind.id)) throw new Error(`Kind ${kind.id} is registered twice`);
        assertValidProperties(kind);
        kinds.set(kind.id, kind);
      }
    }
    // Owners and tools are checked only once every notation is known, so notations may reference each other.
    for (const kind of kinds.values()) {
      for (const owner of kind.allowedOwners) {
        if (!kinds.has(owner)) throw new Error(`Kind ${kind.id} allows unknown owner ${owner}`);
      }
      assertValidTools(kind, kinds);
    }
    return new Registry(kinds);
  }

  kind(id: string): ElementKind | undefined {
    return this.#kinds.get(id);
  }

  kinds(): readonly ElementKind[] {
    return [...this.#kinds.values()];
  }

  kindsAllowedUnder(ownerKindId: string): readonly ElementKind[] {
    return this.kinds().filter((kind) => kind.allowedOwners.includes(ownerKindId));
  }
}

function assertValidProperties(kind: ElementKind): void {
  const keys = new Set<string>();
  for (const property of kind.properties) {
    if (keys.has(property.key)) {
      throw new Error(`Kind ${kind.id} defines property ${property.key} twice`);
    }
    keys.add(property.key);
    if (property.type === 'enum' && !property.options.includes(property.default)) {
      throw new Error(
        `Kind ${kind.id}.${property.key} default "${property.default}" is not one of its options`,
      );
    }
  }
}

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
