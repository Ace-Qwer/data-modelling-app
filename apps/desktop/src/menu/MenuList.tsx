import { useState } from 'react';
import { formatShortcut } from '../shortcuts';
import type { MenuNode } from './menu-model';

interface MenuListProps {
  readonly label: string;
  readonly nodes: readonly MenuNode[];
  readonly isMac: boolean;
  readonly onRun: (id: string) => void;
}

export function MenuList({ label, nodes, isMac, onRun }: MenuListProps) {
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  return (
    <div className="menu-popup" role="menu" aria-label={label}>
      {nodes.map((node, index) => {
        switch (node.kind) {
          case 'separator':
            return (
              <div key={`separator-${String(index)}`} className="menu-separator" role="separator" />
            );
          case 'submenu':
            return (
              <div key={node.label} className="menu-submenu">
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  disabled={node.enabled === false}
                  aria-expanded={openSubmenu === node.label}
                  onClick={() => {
                    setOpenSubmenu(openSubmenu === node.label ? null : node.label);
                  }}
                >
                  <span className="menu-check" />
                  <span>{node.label}</span>
                  <span className="menu-shortcut" aria-hidden="true">
                    ▸
                  </span>
                </button>
                {openSubmenu === node.label && (
                  <MenuList label={node.label} nodes={node.children} isMac={isMac} onRun={onRun} />
                )}
              </div>
            );
          case 'item':
            return (
              <button
                type="button"
                key={node.id}
                role={node.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                aria-checked={node.checked}
                disabled={!node.enabled}
                onClick={() => {
                  onRun(node.id);
                }}
              >
                <span className="menu-check" aria-hidden="true">
                  {node.checked === true ? '✓' : ''}
                </span>
                <span>{node.label}</span>
                {node.shortcut !== undefined && (
                  <span className="menu-shortcut" aria-hidden="true">
                    {formatShortcut(node.shortcut, isMac)}
                  </span>
                )}
              </button>
            );
        }
      })}
    </div>
  );
}
