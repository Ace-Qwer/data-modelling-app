import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TopMenu } from './menu/menu-model';
import { MenuBar } from './MenuBar';

const menus: readonly TopMenu[] = [
  {
    label: 'Edit',
    children: [
      { kind: 'item', id: 'edit.undo', label: 'Undo', shortcut: 'Mod+Z', enabled: false },
      { kind: 'separator' },
      { kind: 'item', id: 'edit.delete', label: 'Delete', shortcut: 'Delete', enabled: true },
    ],
  },
  {
    label: 'Model',
    children: [
      {
        kind: 'submenu',
        label: 'Add',
        children: [{ kind: 'item', id: 'add.core:Package', label: 'Package', enabled: true }],
      },
    ],
  },
  {
    label: 'View',
    children: [
      { kind: 'item', id: 'view.toolbox', label: 'Toolbox', enabled: true, checked: false },
    ],
  },
];

function renderMenuBar() {
  const onRun = vi.fn<(id: string) => void>();
  render(<MenuBar menus={menus} isMac={false} onRun={onRun} />);
  return { onRun, user: userEvent.setup() };
}

describe('MenuBar', () => {
  it('opens a menu with its items, separators, enabled states and shortcut hints', async () => {
    const { user } = renderMenuBar();

    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(screen.getByRole('menuitem', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Undo' })).toHaveTextContent('Ctrl+Z');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeEnabled();
    expect(screen.getAllByRole('separator')).toHaveLength(1);
  });

  it('opens a submenu and runs its item, closing the menus', async () => {
    const { user, onRun } = renderMenuBar();

    await user.click(screen.getByRole('menuitem', { name: 'Model' }));
    await user.click(screen.getByRole('menuitem', { name: 'Add' }));
    await user.click(screen.getByRole('menuitem', { name: 'Package' }));

    expect(onRun).toHaveBeenCalledWith('add.core:Package');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders checkable items with their checked state', async () => {
    const { user } = renderMenuBar();

    await user.click(screen.getByRole('menuitem', { name: 'View' }));

    expect(screen.getByRole('menuitemcheckbox', { name: 'Toolbox' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('closes on Escape and on a click outside', async () => {
    const { user } = renderMenuBar();
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
