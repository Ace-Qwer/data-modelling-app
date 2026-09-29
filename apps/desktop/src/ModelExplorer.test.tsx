import type { Notation } from '@dm/metamodel';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ModelExplorer } from './ModelExplorer';
import { addElement, createActionContext } from './testing/fixture';

type Fixture = ReturnType<typeof createActionContext>;

// The model is populated before rendering so no update happens outside act().
function renderExplorer(
  prepare: (fixture: Fixture) => void = () => undefined,
  notations?: readonly Notation[],
) {
  const fixture = createActionContext(notations);
  prepare(fixture);
  render(<ModelExplorer model={fixture.model} registry={fixture.registry} ui={fixture.ui} />);
  return { ...fixture, user: userEvent.setup() };
}

const item = (name: string) => screen.getByRole('treeitem', { name });

function childNames(name: string): (string | null)[] {
  const group = within(item(name)).getByRole('group');
  return [...group.children].map((child) => child.getAttribute('aria-label'));
}

describe('ModelExplorer', () => {
  it('shows the project with its Model nested one level deeper', () => {
    renderExplorer();

    expect(item('Untitled Project')).toHaveAttribute('aria-level', '1');
    expect(item('Model')).toHaveAttribute('aria-level', '2');
  });

  it('orders packages, then diagrams, then elements, each alphabetically', () => {
    renderExplorer(({ model, modelId }) => {
      addElement(model, 'uml:Class', modelId, 'Zeta');
      addElement(model, 'uml:Class', modelId, 'Alpha');
      addElement(model, 'uml:ClassDiagram', modelId, 'Main');
      addElement(model, 'core:Package', modelId, 'Beta');
    });

    expect(childNames('Model')).toEqual(['Beta', 'Main', 'Alpha', 'Zeta']);
  });

  it('shows the icon each kind asks for', () => {
    renderExplorer(({ model, modelId }) => {
      addElement(model, 'uml:Class', modelId, 'Order');
    });

    expect(item('Order').querySelector('[data-icon]')).toHaveAttribute('data-icon', 'box');
  });

  it.each(['no-such-icon', 'toString', 'constructor'])(
    'falls back to a generic icon for the unknown icon id %j',
    (icon) => {
      const notation: Notation = {
        id: 'odd',
        label: 'Odd',
        kinds: [
          {
            id: 'odd:Thing',
            label: 'Thing',
            icon,
            category: 'element',
            allowedOwners: ['core:Model'],
            properties: [],
          },
        ],
      };
      renderExplorer(
        ({ model, modelId }) => {
          addElement(model, 'odd:Thing', modelId, 'Oddity');
        },
        [notation],
      );

      expect(item('Oddity').querySelector('[data-icon]')).toHaveAttribute('data-icon', 'fallback');
    },
  );

  it('selects an element on click', async () => {
    const { user, ui, modelId } = renderExplorer();

    await user.click(item('Model'));

    expect(ui.getState().selectedId).toBe(modelId);
    expect(item('Model')).toHaveAttribute('aria-selected', 'true');
    expect(item('Untitled Project')).toHaveAttribute('aria-selected', 'false');
  });

  it('opens a diagram on double-click but not other elements', async () => {
    let diagram = '';
    const { user, ui } = renderExplorer(({ model, modelId }) => {
      diagram = addElement(model, 'uml:ClassDiagram', modelId, 'Overview');
      addElement(model, 'uml:Class', modelId, 'Order');
    });

    await user.dblClick(item('Order'));
    expect(ui.getState().openDiagramIds).toEqual([]);

    await user.dblClick(item('Overview'));
    expect(ui.getState().openDiagramIds).toEqual([diagram]);
  });

  it('collapses and expands a node without selecting it', async () => {
    const { user, ui } = renderExplorer();

    await user.click(screen.getByRole('button', { name: 'Collapse Untitled Project' }));
    expect(screen.queryByRole('treeitem', { name: 'Model' })).not.toBeInTheDocument();
    expect(item('Untitled Project')).toHaveAttribute('aria-expanded', 'false');
    expect(ui.getState().selectedId).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Expand Untitled Project' }));
    expect(item('Model')).toBeInTheDocument();
  });

  it('shows siblings with the same name separately and selects only the clicked one', async () => {
    const ids: string[] = [];
    const { user, ui } = renderExplorer(({ model, modelId }) => {
      ids.push(addElement(model, 'uml:Class', modelId, 'New Class'));
      ids.push(addElement(model, 'uml:Class', modelId, 'New Class'));
    });

    const twins = screen.getAllByRole('treeitem', { name: 'New Class' });
    expect(twins).toHaveLength(2);

    await user.click(twins[1] ?? document.body);

    expect(ids).toContain(ui.getState().selectedId);
    expect(twins.filter((t) => t.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  });

  it('follows model changes by itself', () => {
    const { model, modelId } = renderExplorer();

    act(() => {
      addElement(model, 'core:Package', modelId, 'Live');
    });

    expect(item('Live')).toBeInTheDocument();
  });
});
