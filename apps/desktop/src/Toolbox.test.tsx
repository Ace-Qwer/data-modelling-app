import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addElement, createActionContext } from './testing/fixture';
import { Toolbox } from './Toolbox';

function renderToolbox() {
  const fixture = createActionContext();
  const pkg = addElement(fixture.model, 'core:Package', fixture.modelId, 'Ordering');
  const diagram = addElement(fixture.model, 'uml:ClassDiagram', pkg, 'Overview');
  render(<Toolbox model={fixture.model} registry={fixture.registry} ui={fixture.ui} />);
  return { ...fixture, pkg, diagram, user: userEvent.setup() };
}

describe('Toolbox', () => {
  it('asks for a diagram when none is active', () => {
    renderToolbox();

    expect(screen.getByText('Open a diagram to see its tools')).toBeInTheDocument();
  });

  it("shows the active diagram's tools under the diagram kind's name", () => {
    const { ui, diagram } = renderToolbox();

    act(() => {
      ui.getState().openDiagram(diagram);
    });

    expect(screen.getByRole('toolbar', { name: 'Toolbox' })).toBeInTheDocument();
    expect(screen.getByText('Class Diagram')).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Class', 'Package']);
  });

  it("adds the tool's element to the diagram's package, selected, as one undo step", async () => {
    const { ui, diagram, pkg, model, user } = renderToolbox();
    act(() => {
      ui.getState().openDiagram(diagram);
    });

    await user.click(screen.getByRole('button', { name: 'Class' }));

    const created = model.children(pkg).find((e) => e.kind === 'uml:Class');
    expect(created?.name).toBe('New Class');
    expect(ui.getState().selectedId).toBe(created?.id);
    act(() => {
      model.undo();
    });
    expect(model.children(pkg).some((e) => e.kind === 'uml:Class')).toBe(false);
  });

  it('reveals the new element even when the package is collapsed in the tree', async () => {
    const { ui, diagram, pkg, user } = renderToolbox();
    act(() => {
      ui.getState().openDiagram(diagram);
      ui.getState().toggleCollapsed(pkg);
    });

    await user.click(screen.getByRole('button', { name: 'Package' }));

    expect(ui.getState().collapsedIds.has(pkg)).toBe(false);
  });

  it('reveals the new element when a higher ancestor is collapsed', async () => {
    const { ui, diagram, model, user } = renderToolbox();
    act(() => {
      ui.getState().openDiagram(diagram);
      ui.getState().toggleCollapsed(model.root.id);
    });

    await user.click(screen.getByRole('button', { name: 'Class' }));

    expect(ui.getState().collapsedIds.has(model.root.id)).toBe(false);
  });
});
