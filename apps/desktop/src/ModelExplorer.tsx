import type { Element } from '@dm/core';
import type { KindCategory, Registry } from '@dm/metamodel';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useStore } from 'zustand';
import { KindIcon } from './icons';
import type { PanelProps } from './panel-props';
import { useModel } from './use-model';

const CATEGORY_ORDER: Readonly<Record<KindCategory, number>> = {
  package: 0,
  diagram: 1,
  element: 2,
};

function sortForTree(elements: readonly Element[], registry: Registry): Element[] {
  const rank = (e: Element) => CATEGORY_ORDER[registry.kind(e.kind)?.category ?? 'element'];
  return [...elements].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

type OpenContextMenu = (at: { x: number; y: number }) => void;

export function ModelExplorer(props: PanelProps & { readonly onContextMenu?: OpenContextMenu }) {
  useModel(props.model);
  return (
    <div className="panel model-explorer">
      <h2 className="panel-title">Model Explorer</h2>
      <ul className="tree" role="tree" aria-label="Model Explorer">
        <TreeNode {...props} element={props.model.root} level={1} />
      </ul>
    </div>
  );
}

function TreeNode({
  model,
  registry,
  ui,
  element,
  level,
  onContextMenu,
}: PanelProps & { element: Element; level: number; readonly onContextMenu?: OpenContextMenu }) {
  const selected = useStore(ui, (s) => s.selectedId === element.id);
  const collapsed = useStore(ui, (s) => s.collapsedIds.has(element.id));
  const kind = registry.kind(element.kind);
  const children = sortForTree(model.children(element.id), registry);
  const hasChildren = children.length > 0;
  const expanded = hasChildren && !collapsed;

  return (
    <li
      role="treeitem"
      aria-label={element.name}
      aria-level={level}
      aria-selected={selected}
      aria-expanded={hasChildren ? expanded : undefined}
      onClick={(event) => {
        event.stopPropagation();
        ui.getState().select(element.id);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        ui.getState().select(element.id);
        onContextMenu?.({ x: event.clientX, y: event.clientY });
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (kind?.category === 'diagram') ui.getState().openDiagram(element.id);
      }}
    >
      <div
        className="tree-row"
        data-selected={selected}
        style={{ paddingLeft: `${String(level - 1)}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="tree-toggle"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${element.name}`}
            onClick={(event) => {
              event.stopPropagation();
              ui.getState().toggleCollapsed(element.id);
            }}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="tree-toggle" />
        )}
        <KindIcon icon={kind?.icon} />
        <span className="tree-label">{element.name}</span>
      </div>
      {expanded && (
        <ul role="group">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              model={model}
              registry={registry}
              ui={ui}
              element={child}
              level={level + 1}
              {...(onContextMenu ? { onContextMenu } : {})}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
