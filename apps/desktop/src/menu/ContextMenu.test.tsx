import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContextMenu } from './ContextMenu';
import type { MenuNode } from './menu-model';

const nodes: readonly MenuNode[] = [
  { kind: 'item', id: 'edit.delete', label: 'Delete', shortcut: 'Delete', enabled: true },
];

function renderContextMenu() {
  const onRun = vi.fn<(id: string) => void>();
  const onClose = vi.fn<() => void>();
  render(
    <ContextMenu
      nodes={nodes}
      at={{ x: 40, y: 60 }}
      isMac={false}
      onRun={onRun}
      onClose={onClose}
    />,
  );
  return { onRun, onClose, user: userEvent.setup() };
}

describe('ContextMenu', () => {
  it('appears at the pointer', () => {
    renderContextMenu();

    expect(screen.getByRole('menu', { name: 'Context menu' }).parentElement).toHaveStyle({
      left: '40px',
      top: '60px',
    });
  });

  it('runs an item and closes', async () => {
    const { user, onRun, onClose } = renderContextMenu();

    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(onRun).toHaveBeenCalledWith('edit.delete');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const { user, onClose } = renderContextMenu();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });
});
