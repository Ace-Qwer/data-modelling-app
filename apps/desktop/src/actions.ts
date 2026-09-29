import type { Element, Model } from '@dm/core';
import { MODEL_KIND, PROJECT_KIND, type Registry } from '@dm/metamodel';
import { ulid } from 'ulid';
import type { UiStore } from './ui-store';

export interface ActionContext {
  readonly model: Model;
  readonly registry: Registry;
  readonly ui: UiStore;
  readonly newProject: () => void;
}

export interface Action {
  readonly id: string;
  readonly label: string;
  readonly shortcuts?: readonly string[];
  isEnabled(ctx: ActionContext): boolean;
  run(ctx: ActionContext): void;
}

// Every project keeps its root and its Model so there is always somewhere to add elements.
const UNDELETABLE_KINDS: readonly string[] = [PROJECT_KIND, MODEL_KIND];

function selectedElement(ctx: ActionContext): Element | undefined {
  const { selectedId } = ctx.ui.getState();
  return selectedId === null ? undefined : ctx.model.getElement(selectedId);
}

function unavailable(feature: string): Action['run'] {
  return () => {
    throw new Error(`${feature} is not available yet`);
  };
}

export const fileActions: readonly Action[] = [
  {
    id: 'file.new',
    label: 'New Project',
    isEnabled: () => true,
    run: (ctx) => {
      ctx.newProject();
    },
  },
  { id: 'file.open', label: 'Open…', isEnabled: () => false, run: unavailable('Opening projects') },
  { id: 'file.save', label: 'Save', isEnabled: () => false, run: unavailable('Saving projects') },
];

export const editActions: readonly Action[] = [
  {
    id: 'edit.undo',
    label: 'Undo',
    shortcuts: ['Mod+Z'],
    isEnabled: (ctx) => ctx.model.canUndo,
    run: (ctx) => {
      ctx.model.undo();
    },
  },
  {
    id: 'edit.redo',
    label: 'Redo',
    shortcuts: ['Mod+Shift+Z', 'Mod+Y'],
    isEnabled: (ctx) => ctx.model.canRedo,
    run: (ctx) => {
      ctx.model.redo();
    },
  },
  {
    id: 'edit.delete',
    label: 'Delete',
    shortcuts: ['Delete'],
    isEnabled: (ctx) => {
      const element = selectedElement(ctx);
      return element !== undefined && !UNDELETABLE_KINDS.includes(element.kind);
    },
    run: (ctx) => {
      const element = selectedElement(ctx);
      if (element) ctx.model.execute({ type: 'RemoveElement', id: element.id });
    },
  },
];

export function addActions(registry: Registry): readonly Action[] {
  return registry
    .kinds()
    .filter((kind) => kind.id !== PROJECT_KIND)
    .map((kind) => ({
      id: `add.${kind.id}`,
      label: kind.label,
      isEnabled: (ctx: ActionContext) => {
        const owner = selectedElement(ctx);
        return owner !== undefined && kind.allowedOwners.includes(owner.kind);
      },
      run: (ctx: ActionContext) => {
        const owner = selectedElement(ctx);
        if (!owner) return;
        const id = ulid();
        ctx.ui.getState().expand(owner.id);
        ctx.model.execute({
          type: 'AddElement',
          element: {
            id,
            kind: kind.id,
            name: `New ${kind.label}`,
            ownerId: owner.id,
            properties: {},
          },
        });
        ctx.ui.getState().select(id);
      },
    }));
}
