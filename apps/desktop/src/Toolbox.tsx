import { useStore } from 'zustand';
import { addElement } from './actions';
import { KindIcon } from './icons';
import type { PanelProps } from './panel-props';
import { useModel } from './use-model';

export function Toolbox({ model, registry, ui }: PanelProps) {
  useModel(model);
  const activeId = useStore(ui, (s) => s.activeDiagramId);
  const diagram = activeId === null ? undefined : model.getElement(activeId);
  const diagramKind = diagram ? registry.kind(diagram.kind) : undefined;
  const ownerId = diagram?.ownerId ?? null;

  if (!diagramKind || ownerId === null) {
    return (
      <div className="panel toolbox">
        <h2 className="panel-title">Toolbox</h2>
        <p className="panel-empty">Open a diagram to see its tools</p>
      </div>
    );
  }

  const tools = (diagramKind.tools ?? []).flatMap((id) => {
    const kind = registry.kind(id);
    return kind ? [kind] : [];
  });

  return (
    <div className="panel toolbox">
      <h2 className="panel-title">Toolbox</h2>
      <p className="toolbox-heading">{diagramKind.label}</p>
      <div
        className="toolbox-tools"
        role="toolbar"
        aria-label="Toolbox"
        aria-orientation="vertical"
      >
        {tools.map((kind) => (
          <button
            type="button"
            className="toolbox-tool"
            key={kind.id}
            onClick={() => {
              addElement(model, ui, kind, ownerId);
            }}
          >
            <KindIcon icon={kind.icon} />
            {kind.label}
          </button>
        ))}
      </div>
    </div>
  );
}
