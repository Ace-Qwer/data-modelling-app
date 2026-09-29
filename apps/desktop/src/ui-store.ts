import type { Model } from '@dm/core';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface UiState {
  readonly selectedId: string | null;
  readonly collapsedIds: ReadonlySet<string>;
  readonly openDiagramIds: readonly string[];
  readonly activeDiagramId: string | null;
  select(id: string | null): void;
  toggleCollapsed(id: string): void;
  expand(id: string): void;
  openDiagram(id: string): void;
  closeDiagram(id: string): void;
  activateDiagram(id: string): void;
}

export type UiStore = StoreApi<UiState>;

export function createUiStore(): UiStore {
  return createStore<UiState>()((set) => ({
    selectedId: null,
    collapsedIds: new Set(),
    openDiagramIds: [],
    activeDiagramId: null,
    select: (id) => {
      set({ selectedId: id });
    },
    toggleCollapsed: (id) => {
      set((s) => {
        const collapsedIds = new Set(s.collapsedIds);
        if (!collapsedIds.delete(id)) collapsedIds.add(id);
        return { collapsedIds };
      });
    },
    expand: (id) => {
      set((s) => {
        const collapsedIds = new Set(s.collapsedIds);
        collapsedIds.delete(id);
        return { collapsedIds };
      });
    },
    openDiagram: (id) => {
      set((s) => ({
        openDiagramIds: s.openDiagramIds.includes(id)
          ? s.openDiagramIds
          : [...s.openDiagramIds, id],
        activeDiagramId: id,
      }));
    },
    closeDiagram: (id) => {
      set((s) => {
        const openDiagramIds = s.openDiagramIds.filter((open) => open !== id);
        const activeDiagramId =
          s.activeDiagramId === id ? (openDiagramIds.at(-1) ?? null) : s.activeDiagramId;
        return { openDiagramIds, activeDiagramId };
      });
    },
    activateDiagram: (id) => {
      set({ activeDiagramId: id });
    },
  }));
}

export function bindToModel(ui: UiStore, model: Model): () => void {
  return model.subscribe(() => {
    const { selectedId, openDiagramIds, activeDiagramId } = ui.getState();
    const exists = (id: string | null) => id !== null && model.getElement(id) !== undefined;
    const stillOpen = openDiagramIds.filter(exists);
    const selectionValid = selectedId === null || exists(selectedId);
    if (selectionValid && stillOpen.length === openDiagramIds.length) return;
    ui.setState({
      selectedId: exists(selectedId) ? selectedId : null,
      openDiagramIds: stillOpen,
      activeDiagramId: exists(activeDiagramId) ? activeDiagramId : (stillOpen.at(-1) ?? null),
    });
  });
}
