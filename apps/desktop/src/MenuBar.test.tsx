import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { editActions, fileActions } from './actions';
import { MenuBar } from './MenuBar';
import { addElement, createActionContext } from './testing/fixture';

function renderMenuBar() {
  const fixture = createActionContext();
  const menus = [
    { label: 'File', actions: fileActions },
    { label: 'Edit', actions: editActions },
  ];
  render(<MenuBar menus={menus} ctx={fixture.ctx} />);
  return { ...fixture, user: userEvent.setup() };
}

describe('MenuBar', () => {
  it('opens a menu listing its actions with their enabled state', async () => {
    const { user } = renderMenuBar();

    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(screen.getByRole('menu', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Redo' })).toBeDisabled();
  });

  it('shows the platform shortcut next to an item', async () => {
    const { user } = renderMenuBar();

    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(screen.getByRole('menuitem', { name: 'Undo' })).toHaveTextContent('Ctrl+Z');
  });

  it('updates enablement when the model changes while the menu is open', async () => {
    const { user, model, modelId } = renderMenuBar();
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));

    act(() => {
      addElement(model, 'core:Package', modelId, 'Ordering');
    });

    expect(screen.getByRole('menuitem', { name: 'Undo' })).toBeEnabled();
  });

  it('runs an item and closes the menu', async () => {
    const { user, newProject } = renderMenuBar();

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'New Project' }));

    expect(newProject).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const { user } = renderMenuBar();
    await user.click(screen.getByRole('menuitem', { name: 'File' }));

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes when clicking outside the menu bar', async () => {
    const { user } = renderMenuBar();
    await user.click(screen.getByRole('menuitem', { name: 'File' }));

    await user.click(document.body);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('toggles a menu closed when its title is clicked again', async () => {
    const { user } = renderMenuBar();
    await user.click(screen.getByRole('menuitem', { name: 'File' }));

    await user.click(screen.getByRole('menuitem', { name: 'File' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
