import type { Element } from '@dm/core';
import { X } from 'lucide-react';
import { useStore } from 'zustand';
import type { PanelProps } from './panel-props';
import { useModel } from './use-model';

export function CanvasArea({ model, ui }: PanelProps) {
  useModel(model);
  const openIds = useStore(ui, (s) => s.openDiagramIds);
  const activeId = useStore(ui, (s) => s.activeDiagramId);
  const open = openIds.flatMap((id): Element[] => {
    const diagram = model.getElement(id);
    return diagram ? [diagram] : [];
  });
  const active = open.find((d) => d.id === activeId) ?? open[0];

  if (!active) {
    return (
      <div className="canvas-area canvas-empty">
        <p>Open a diagram from the Model Explorer</p>
      </div>
    );
  }

  return (
    <div className="canvas-area">
      <div className="canvas-tabs" role="tablist" aria-label="Open diagrams">
        {open.map((diagram) => (
          <div className="canvas-tab" key={diagram.id} data-active={diagram.id === active.id}>
            <button
              type="button"
              role="tab"
              aria-selected={diagram.id === active.id}
              onClick={() => {
                ui.getState().activateDiagram(diagram.id);
              }}
            >
              {diagram.name}
            </button>
            <button
              type="button"
              className="canvas-tab-close"
              aria-label={`Close ${diagram.name}`}
              onClick={() => {
                ui.getState().closeDiagram(diagram.id);
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <div
        className="canvas-surface"
        role="tabpanel"
        aria-label={active.name}
        data-diagram-id={active.id}
      />
    </div>
  );
}
