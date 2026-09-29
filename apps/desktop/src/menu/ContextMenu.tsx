import { useRef } from 'react';
import type { MenuNode } from './menu-model';
import { MenuList } from './MenuList';
import { useDismiss } from './use-dismiss';

interface ContextMenuProps {
  readonly nodes: readonly MenuNode[];
  readonly at: { readonly x: number; readonly y: number };
  readonly isMac: boolean;
  readonly onRun: (id: string) => void;
  readonly onClose: () => void;
}

export function ContextMenu({ nodes, at, isMac, onRun, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(true, ref, onClose);
  return (
    <div className="context-menu" ref={ref} style={{ left: at.x, top: at.y }}>
      <MenuList
        label="Context menu"
        nodes={nodes}
        isMac={isMac}
        onRun={(id) => {
          onClose();
          onRun(id);
        }}
      />
    </div>
  );
}
