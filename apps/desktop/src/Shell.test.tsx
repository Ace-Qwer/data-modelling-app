import { Model } from '@dm/core';
import { serializeProject } from '@dm/io';
import { Registry } from '@dm/metamodel';
import { umlNotation } from '@dm/notation-uml';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Shell } from './Shell';
import { createTestPlatform } from './testing/platform';

function renderShell(options: Parameters<typeof createTestPlatform>[0] = {}) {
  const registry = Registry.create([umlNotation]);
  const test = createTestPlatform(options);
  render(
    <Shell registry={registry} createModel={() => new Model(registry)} platform={test.platform} />,
  );
  return { user: userEvent.setup(), ...test };
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
    const { user } = renderShell();

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
    const { user } = renderShell();
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

  it('starts over with File → New Project after Don’t Save', async () => {
    const { user, memory } = renderShell();
    await user.click(item('Model'));
    await menu(user, 'Model', 'Add', 'Class');
    memory.answers.discard.push('discard');

    await menu(user, 'File', 'New Project');

    await waitFor(() => {
      expect(screen.queryByRole('treeitem', { name: 'New Class' })).not.toBeInTheDocument();
    });
    expect(item('Model')).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(screen.getByRole('menuitem', { name: 'Undo' })).toBeDisabled();
  });

  it('keeps Delete in the Name field after committing a rename with Enter', async () => {
    const { user } = renderShell();
    await user.click(item('Model'));
    await menu(user, 'Model', 'Add', 'Package');

    await user.type(screen.getByLabelText('Name'), 's{Enter}');
    await user.keyboard('{Delete}');

    expect(item('New Packages')).toBeInTheDocument();
  });

  it('leaves Delete and Ctrl+Z to the text field while typing in Properties', async () => {
    const { user } = renderShell();
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
    const { user } = renderShell();
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
    const { user } = renderShell();

    await user.pointer({ keys: '[MouseRight]', target: item('Model') });
    const contextMenu = screen.getByRole('menu', { name: 'Context menu' });
    await user.click(within(contextMenu).getByRole('menuitem', { name: 'Add' }));
    await user.click(screen.getByRole('menuitem', { name: 'Package' }));

    expect(item('New Package')).toBeInTheDocument();
  });

  it('hides and shows panels from the View menu, even both right-hand ones', async () => {
    const { user } = renderShell();

    await menu(user, 'View', 'Properties');
    await menu(user, 'View', 'Model Explorer');
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
    expect(screen.queryByText('Nothing selected')).not.toBeInTheDocument();
    expect(screen.getByText('Open a diagram from the Model Explorer')).toBeInTheDocument();

    await menu(user, 'View', 'Model Explorer');
    expect(screen.getByRole('tree')).toBeInTheDocument();
  });

  it('shows the About dialog from the Help menu', async () => {
    const { user } = renderShell();

    await menu(user, 'Help', 'About Data Modelling App');

    expect(screen.getByRole('dialog', { name: 'Data Modelling App' })).toBeInTheDocument();
  });

  it('keeps Delete away from the model while the About dialog is open', async () => {
    const { user } = renderShell();
    await user.click(item('Model'));
    await menu(user, 'Model', 'Add', 'Package');

    await menu(user, 'Help', 'About Data Modelling App');
    await user.keyboard('{Delete}');

    expect(item('New Package')).toBeInTheDocument();
  });

  it('acts on the right-clicked item even when another item is selected', async () => {
    const { user } = renderShell();
    await user.click(item('Model'));
    await menu(user, 'Model', 'Add', 'Package');
    await user.click(item('Model'));

    await user.pointer({ keys: '[MouseRight]', target: item('New Package') });
    await user.click(
      within(screen.getByRole('menu', { name: 'Context menu' })).getByRole('menuitem', {
        name: 'Delete',
      }),
    );

    expect(screen.queryByRole('treeitem', { name: 'New Package' })).not.toBeInTheDocument();
    expect(item('Model')).toBeInTheDocument();
  });

  it('saves a new project, titles the window after it and marks later edits', async () => {
    const { user, memory, titles } = renderShell();
    memory.answers.save.push('/p/Ordering');

    await menu(user, 'File', 'Save');
    await waitFor(() => {
      expect(titles.at(-1)).toBe('Ordering.dmproj — Data Modelling App');
    });
    expect(memory.disk.get('/p/Ordering.dmproj')).toContain('"format": "dmproj"');

    await user.click(item('Model'));
    await menu(user, 'Model', 'Add', 'Package');
    await waitFor(() => {
      expect(titles.at(-1)).toBe('• Ordering.dmproj — Data Modelling App');
    });

    await user.click(document.body);
    await user.keyboard('{Control>}z{/Control}');
    await waitFor(() => {
      expect(titles.at(-1)).toBe('Ordering.dmproj — Data Modelling App');
    });
  });

  it('opens a project and lists it under Open Recent', async () => {
    const other = new Model(Registry.create([umlNotation]));
    const otherModel = other.children(other.root.id)[0]?.id ?? '';
    other.execute({
      type: 'AddElement',
      element: {
        id: 'inv',
        kind: 'uml:Class',
        name: 'Invoice',
        ownerId: otherModel,
        properties: {},
      },
    });
    const { user, memory } = renderShell({
      disk: { '/p/Shop.dmproj': serializeProject(other, '0.1.0') },
    });
    memory.answers.open.push('/p/Shop.dmproj');

    await menu(user, 'File', 'Open…');

    expect(await screen.findByRole('treeitem', { name: 'Invoice' })).toBeInTheDocument();
    await menu(user, 'File', 'Open Recent');
    expect(screen.getByRole('menuitem', { name: 'Shop.dmproj (/p)' })).toBeInTheDocument();
  });

  it('keeps unsaved work when New Project is cancelled at the prompt', async () => {
    const { user, memory } = renderShell();
    await user.click(item('Model'));
    await menu(user, 'Model', 'Add', 'Package');
    memory.answers.discard.push('cancel');

    await menu(user, 'File', 'New Project');

    await waitFor(() => {
      expect(memory.prompts).toEqual(['Untitled']);
    });
    expect(item('New Package')).toBeInTheDocument();
  });

  it('asks before closing the window and closes after Don’t Save', async () => {
    const { user, memory, exit, requestClose } = renderShell();
    await user.click(item('Model'));
    await menu(user, 'Model', 'Add', 'Package');
    memory.answers.discard.push('discard');

    requestClose();

    await waitFor(() => {
      expect(exit).toHaveBeenCalledOnce();
    });
    expect(memory.prompts).toEqual(['Untitled']);
  });

  it('saves a name typed but not yet committed when Ctrl+S is pressed in the field', async () => {
    const { user, memory } = renderShell();
    await user.click(item('Model'));
    await menu(user, 'Model', 'Add', 'Package');
    memory.answers.save.push('/p/Typed.dmproj');
    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Ordering');

    await user.keyboard('{Control>}s{/Control}');

    await waitFor(() => {
      expect(memory.disk.get('/p/Typed.dmproj')).toContain('"name": "Ordering"');
    });
  });
});
