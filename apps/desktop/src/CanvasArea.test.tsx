import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CanvasArea } from './CanvasArea';
import { addElement, createActionContext } from './testing/fixture';

function renderCanvas() {
  const fixture = createActionContext();
  const overview = addElement(fixture.model, 'uml:ClassDiagram', fixture.modelId, 'Overview');
  const schema = addElement(fixture.model, 'uml:ClassDiagram', fixture.modelId, 'Schema');
  render(<CanvasArea model={fixture.model} registry={fixture.registry} ui={fixture.ui} />);
  return { ...fixture, overview, schema, user: userEvent.setup() };
}

describe('CanvasArea', () => {
  it('invites the user to open a diagram when none is open', () => {
    renderCanvas();

    expect(screen.getByText('Open a diagram from the Model Explorer')).toBeInTheDocument();
  });

  it('shows a tab per open diagram and the active diagram surface', () => {
    const { ui, overview, schema } = renderCanvas();

    act(() => {
      ui.getState().openDiagram(overview);
      ui.getState().openDiagram(schema);
    });

    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Overview', 'Schema']);
    expect(screen.getByRole('tab', { name: 'Schema' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Schema' })).toHaveAttribute(
      'data-diagram-id',
      schema,
    );
  });

  it('activates a tab on click', async () => {
    const { ui, user, overview, schema } = renderCanvas();
    act(() => {
      ui.getState().openDiagram(overview);
      ui.getState().openDiagram(schema);
    });

    await user.click(screen.getByRole('tab', { name: 'Overview' }));

    expect(ui.getState().activeDiagramId).toBe(overview);
  });

  it('closes a tab with its close button', async () => {
    const { ui, user, overview } = renderCanvas();
    act(() => {
      ui.getState().openDiagram(overview);
    });

    await user.click(screen.getByRole('button', { name: 'Close Overview' }));

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('keeps the tab label in step with a renamed diagram', () => {
    const { ui, model, overview } = renderCanvas();
    act(() => {
      ui.getState().openDiagram(overview);
    });

    act(() => {
      model.execute({ type: 'SetName', id: overview, name: 'Big Picture' });
    });

    expect(screen.getByRole('tab', { name: 'Big Picture' })).toBeInTheDocument();
  });
});
