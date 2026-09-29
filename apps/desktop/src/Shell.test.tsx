import { Model } from '@dm/core';
import { Registry } from '@dm/metamodel';
import { umlNotation } from '@dm/notation-uml';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Shell } from './Shell';

function renderShell() {
  const registry = Registry.create([umlNotation]);
  render(<Shell registry={registry} createModel={() => new Model(registry)} />);
  return userEvent.setup();
}

const item = (name: string) => screen.getByRole('treeitem', { name });

async function menu(user: ReturnType<typeof userEvent.setup>, title: string, entry: string) {
  await user.click(screen.getByRole('menuitem', { name: title }));
  await user.click(
    within(screen.getByRole('menu', { name: title })).getByRole('menuitem', { name: entry }),
  );
}

describe('Shell', () => {
  it('renames a new package in Properties and undoes the rename with Ctrl+Z', async () => {
    const user = renderShell();

    await user.click(item('Model'));
    await menu(user, 'Add', 'Package');
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
    await menu(user, 'Add', 'Package');
    await menu(user, 'Add', 'Class Diagram');
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
    await menu(user, 'Add', 'Class');

    await menu(user, 'File', 'New Project');

    expect(screen.queryByRole('treeitem', { name: 'New Class' })).not.toBeInTheDocument();
    expect(item('Model')).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(screen.getByRole('menuitem', { name: 'Undo' })).toBeDisabled();
  });

  it('keeps Delete in the Name field after committing a rename with Enter', async () => {
    const user = renderShell();
    await user.click(item('Model'));
    await menu(user, 'Add', 'Package');

    await user.type(screen.getByLabelText('Name'), 's{Enter}');
    await user.keyboard('{Delete}');

    expect(item('New Packages')).toBeInTheDocument();
  });

  it('leaves Delete and Ctrl+Z to the text field while typing in Properties', async () => {
    const user = renderShell();
    await user.click(item('Model'));
    await menu(user, 'Add', 'Package');
    const name = screen.getByLabelText('Name');

    await user.click(name);
    await user.keyboard('{Home}{Delete}');
    await user.keyboard('{Control>}z{/Control}');

    expect(item('New Package')).toBeInTheDocument();
    expect(name).toHaveValue('ew Package');
  });
});
