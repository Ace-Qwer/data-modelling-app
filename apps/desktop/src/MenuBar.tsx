import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { Action, ActionContext } from './actions';
import { formatShortcut, isMacPlatform } from './shortcuts';
import { useModel } from './use-model';

export interface Menu {
  readonly label: string;
  readonly actions: readonly Action[];
}

export function MenuBar({ menus, ctx }: { menus: readonly Menu[]; ctx: ActionContext }) {
  useModel(ctx.model);
  useStore(ctx.ui);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const isMac = isMacPlatform();

  useEffect(() => {
    if (openMenu === null) return;
    const onMouseDown = (event: MouseEvent) => {
      if (event.target instanceof Node && barRef.current?.contains(event.target)) return;
      setOpenMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

  return (
    <div className="menu-bar" role="menubar" ref={barRef}>
      {menus.map((menu) => (
        <div className="menu" key={menu.label}>
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={openMenu === menu.label}
            onClick={() => {
              setOpenMenu(openMenu === menu.label ? null : menu.label);
            }}
          >
            {menu.label}
          </button>
          {openMenu === menu.label && (
            <div className="menu-popup" role="menu" aria-label={menu.label}>
              {menu.actions.map((action) => {
                const shortcut = action.shortcuts?.[0];
                return (
                  <button
                    type="button"
                    role="menuitem"
                    key={action.id}
                    disabled={!action.isEnabled(ctx)}
                    aria-keyshortcuts={shortcut}
                    onClick={() => {
                      setOpenMenu(null);
                      action.run(ctx);
                    }}
                  >
                    <span>{action.label}</span>
                    {shortcut !== undefined && (
                      <span className="menu-shortcut" aria-hidden="true">
                        {formatShortcut(shortcut, isMac)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
