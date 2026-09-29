import type { Element, Model } from '@dm/core';
import { MODEL_KIND, PROJECT_KIND, type ElementKind, type Registry } from '@dm/metamodel';
import { ulid } from 'ulid';
import { isTextEntryTarget } from './shortcuts';
import type { PanelName, UiStore } from './ui-store';

export interface ActionContext {
  readonly model: Model;
  readonly registry: Registry;
  readonly ui: UiStore;
  readonly newProject: () => void;
  readonly exit: () => void;
  readonly textCommand: (command: 'undo' | 'redo') => void;
}

export interface Action {
  readonly id: string;
  readonly label: string;
  readonly shortcuts?: readonly string[];
  readonly isEnabled: (ctx: ActionContext) => boolean;
  readonly isChecked?: (ctx: ActionContext) => boolean;
  readonly run: (ctx: ActionContext) => void;
}

const always = () => true;

function selectedElement(ctx: ActionContext): Element | undefined {
  const { selectedId } = ctx.ui.getState();
  return selectedId === null ? undefined : ctx.model.getElement(selectedId);
}

function isTyping(): boolean {
  return isTextEntryTarget(document.activeElement);
}

export function addElement(model: Model, ui: UiStore, kind: ElementKind, ownerId: string): string {
  const id = ulid();
  for (
    let at = model.getElement(ownerId);
    at;
    at = at.ownerId === null ? undefined : model.getElement(at.ownerId)
  ) {
    ui.getState().expand(at.id);
  }
  model.execute({
    type: 'AddElement',
    element: { id, kind: kind.id, name: `New ${kind.label}`, ownerId, properties: {} },
  });
  ui.getState().select(id);
  return id;
}

// Every project keeps its root and at least one Model, so there is always somewhere to add elements.
function isDeletable(ctx: ActionContext, element: Element): boolean {
  if (element.kind === PROJECT_KIND) return false;
  if (element.kind !== MODEL_KIND) return true;
  return ctx.model.elements().filter((e) => e.kind === MODEL_KIND).length > 1;
}

export const fileActions: readonly Action[] = [
  {
    id: 'file.new',
    label: 'New Project',
    isEnabled: always,
    run: (ctx) => {
      ctx.newProject();
    },
  },
  {
    id: 'file.exit',
    label: 'Exit',
    isEnabled: always,
    run: (ctx) => {
      ctx.exit();
    },
  },
];

export const editActions: readonly Action[] = [
  {
    id: 'edit.undo',
    label: 'Undo',
    shortcuts: ['Mod+Z'],
    isEnabled: (ctx) => ctx.model.canUndo || isTyping(),
    run: (ctx) => {
      if (isTyping()) ctx.textCommand('undo');
      else ctx.model.undo();
    },
  },
  {
    id: 'edit.redo',
    label: 'Redo',
    shortcuts: ['Mod+Shift+Z', 'Mod+Y'],
    isEnabled: (ctx) => ctx.model.canRedo || isTyping(),
    run: (ctx) => {
      if (isTyping()) ctx.textCommand('redo');
      else ctx.model.redo();
    },
  },
  {
    id: 'edit.delete',
    label: 'Delete',
    shortcuts: ['Delete'],
    isEnabled: (ctx) => {
      const element = selectedElement(ctx);
      return element !== undefined && isDeletable(ctx, element);
    },
    run: (ctx) => {
      const element = selectedElement(ctx);
      if (element && isDeletable(ctx, element)) {
        ctx.model.execute({ type: 'RemoveElement', id: element.id });
      }
    },
  },
];

function panelToggle(id: string, label: string, panel: PanelName): Action {
  return {
    id,
    label,
    isEnabled: always,
    isChecked: (ctx) => !ctx.ui.getState().hiddenPanels.has(panel),
    run: (ctx) => {
      ctx.ui.getState().togglePanel(panel);
    },
  };
}

export const viewActions: readonly Action[] = [
  panelToggle('view.toolbox', 'Toolbox', 'toolbox'),
  panelToggle('view.explorer', 'Model Explorer', 'explorer'),
  panelToggle('view.properties', 'Properties', 'properties'),
];

export const helpActions: readonly Action[] = [
  {
    id: 'help.about',
    label: 'About Data Modelling App',
    isEnabled: always,
    run: (ctx) => {
      ctx.ui.getState().openAbout();
    },
  },
];

function addKindAction(kind: ElementKind): Action {
  return {
    id: `add.${kind.id}`,
    label: kind.label,
    isEnabled: (ctx) => {
      const owner = selectedElement(ctx);
      return owner !== undefined && kind.allowedOwners.includes(owner.kind);
    },
    run: (ctx) => {
      const owner = selectedElement(ctx);
      if (owner && kind.allowedOwners.includes(owner.kind))
        addElement(ctx.model, ctx.ui, kind, owner.id);
    },
  };
}

export function addElementActions(registry: Registry): readonly Action[] {
  return registry
    .kinds()
    .filter((kind) => kind.id !== PROJECT_KIND && kind.category !== 'diagram')
    .map(addKindAction);
}

export function addDiagramActions(registry: Registry): readonly Action[] {
  return registry
    .kinds()
    .filter((kind) => kind.category === 'diagram')
    .map(addKindAction);
}

export function allActions(registry: Registry): readonly Action[] {
  return [
    ...fileActions,
    ...editActions,
    ...viewActions,
    ...helpActions,
    ...addElementActions(registry),
    ...addDiagramActions(registry),
  ];
}
