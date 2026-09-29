import { Model } from '@dm/core';
import { Registry } from '@dm/metamodel';
import { umlNotation } from '@dm/notation-uml';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Shell } from './Shell';

function renderShell() {
  const registry = Registry.create([umlNotation]);
  const platform = { isTauri: false, isMac: false, exit: () => undefined };
  render(<Shell registry={registry} createModel={() => new Model(registry)} platform={platform} />);
  return userEvent.setup();
}

const item = (name: string) => screen.getByRole('treeitem', { name });

async function menu(user: ReturnType<typeof userEvent.setup>, top: string, ...rest: string[]) {
  await user.click(screen.getByRole('menuitem', { name: top }));
  for (const entry of rest) {
    // View entries are check items, so look for both item roles; the newest popup renders last.
    const matches = [
      ...screen.queryAllByRole('menuitem', { name: entry }),
      ...screen.queryAllByRole('menuitemcheckbox', { name: entry }),
    ];
    await user.click(matches.at(-1) ?? document.body);
  }
}

describe('Shell', () => {
  it('renames a new package in Properties and undoes the rename with Ctrl+Z', async () => {
    const user = renderShell();

    await user.click(item('Model'));
    await menu(user, 'Model', 'Add', 'Package');
    expect(item('New Package')).toHaveAttribute('aria-selected', 'true');

    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Ordering{Enter}');
    expect(item('Ordering')).toBeInTheDocument();

    await user.click(document.body);
    await user.keyboard('{Control>}z{/Control}');
    expect(item('New Package')).toBeInTheDocument();
  });

  it('closes an open diagram when its package is deleted and restores the tree on undo', async () => {
    const user = renderShell();
    await user.click(item('Model'));
    await menu(user, 'Model', 'Add', 'Package');
    await menu(user, 'Model', 'Add Diagram', 'Class Diagram');
    await user.dblClick(item('New Class Diagram'));
    expect(screen.getByRole('tab', { name: 'New Class Diagram' })).toBeInTheDocument();

    await user.click(item('New Package'));
    await menu(user, 'Edit', 'Delete');

    expect(screen.queryByRole('treeitem', { name: 'New Package' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();

    await menu(user, 'Edit', 'Undo');
    expect(item('New Class Diagram')).toBeInTheDocument();
  });

  it('starts over with File → New Project', async () => {
    const user = renderShell();
    await user.click(item('Model'));
    await menu(user, 'Model', 'Add', 'Class');

    await menu(user, 'File', 'New Project');

    expect(screen.queryByRole('treeitem', { name: 'New Class' })).not.toBeInTheDocument();
    expect(item('Model')).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(screen.getByRole('menuitem', { name: 'Undo' })).toBeDisabled();
  });

  it('keeps Delete in the Name field after committing a rename with Enter', async () => {
    const user = renderShell();
    await user.click(item('Model'));
    await menu(user, 'Model', 'Add', 'Package');

    await user.type(screen.getByLabelText('Name'), 's{Enter}');
    await user.keyboard('{Delete}');

    expect(item('New Packages')).toBeInTheDocument();
  });

  it('leaves Delete and Ctrl+Z to the text field while typing in Properties', async () => {
    const user = renderShell();
    await user.click(item('Model'));
    await menu(user, 'Model', 'Add', 'Package');
    const name = screen.getByLabelText('Name');

    await user.click(name);
    await user.keyboard('{Home}{Delete}');
    await user.keyboard('{Control>}z{/Control}');

    expect(item('New Package')).toBeInTheDocument();
    expect(name).toHaveValue('ew Package');
  });

  it('lays out Toolbox, canvas, Model Explorer and Properties', () => {
    renderShell();

    const order = [...document.querySelectorAll('.panel-title')].map((h) => h.textContent);
    expect(order).toEqual(['Toolbox', 'Model Explorer', 'Properties']);
    expect(screen.getByText('Open a diagram from the Model Explorer')).toBeInTheDocument();
  });

  it('adds a class from the Toolbox of the open diagram and undoes it', async () => {
    const user = renderShell();
    await user.click(item('Model'));
    await menu(user, 'Model', 'Add Diagram', 'Class Diagram');
    await user.dblClick(item('New Class Diagram'));

    await user.click(
      within(screen.getByRole('toolbar', { name: 'Toolbox' })).getByRole('button', {
        name: 'Class',
      }),
    );
    expect(item('New Class')).toHaveAttribute('aria-selected', 'true');

    await user.click(document.body);
    await user.keyboard('{Control>}z{/Control}');
    expect(screen.queryByRole('treeitem', { name: 'New Class' })).not.toBeInTheDocument();
  });

  it('adds a package from the right-click menu of a tree item', async () => {
    const user = renderShell();

    await user.pointer({ keys: '[MouseRight]', target: item('Model') });
    const contextMenu = screen.getByRole('menu', { name: 'Context menu' });
    await user.click(within(contextMenu).getByRole('menuitem', { name: 'Add' }));
    await user.click(screen.getByRole('menuitem', { name: 'Package' }));

    expect(item('New Package')).toBeInTheDocument();
  });

  it('hides and shows panels from the View menu, even both right-hand ones', async () => {
    const user = renderShell();

    await menu(user, 'View', 'Properties');
    await menu(user, 'View', 'Model Explorer');
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
    expect(screen.queryByText('Nothing selected')).not.toBeInTheDocument();
    expect(screen.getByText('Open a diagram from the Model Explorer')).toBeInTheDocument();

    await menu(user, 'View', 'Model Explorer');
    expect(screen.getByRole('tree')).toBeInTheDocument();
  });

  it('shows the About dialog from the Help menu', async () => {
    const user = renderShell();

    await menu(user, 'Help', 'About Data Modelling App');

    expect(screen.getByRole('dialog', { name: 'Data Modelling App' })).toBeInTheDocument();
  });

  it('keeps Delete away from the model while the About dialog is open', async () => {
    const user = renderShell();
    await user.click(item('Model'));
    await menu(user, 'Model', 'Add', 'Package');

    await menu(user, 'Help', 'About Data Modelling App');
    await user.keyboard('{Delete}');

    expect(item('New Package')).toBeInTheDocument();
  });
});
