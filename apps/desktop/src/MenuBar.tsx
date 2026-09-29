import { useCallback, useRef, useState } from 'react';
import type { TopMenu } from './menu/menu-model';
import { MenuList } from './menu/MenuList';
import { useDismiss } from './menu/use-dismiss';

interface MenuBarProps {
  readonly menus: readonly TopMenu[];
  readonly isMac: boolean;
  readonly onRun: (id: string) => void;
}

export function MenuBar({ menus, isMac, onRun }: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    setOpenMenu(null);
  }, []);
  useDismiss(openMenu !== null, barRef, close);

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
            <MenuList
              label={menu.label}
              nodes={menu.children}
              isMac={isMac}
              onRun={(id) => {
                close();
                onRun(id);
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
