import { describe, expect, it } from 'vitest';
import { addElement, createFixture } from './testing/fixture';
import { bindToModel, createUiStore } from './ui-store';

function setup() {
  const fixture = createFixture();
  const ui = createUiStore();
  const unbind = bindToModel(ui, fixture.model);
  return { ...fixture, ui, unbind };
}

describe('UI store', () => {
  it('opens a diagram only once and makes the opened one active', () => {
    const { ui } = setup();

    ui.getState().openDiagram('a');
    ui.getState().openDiagram('b');
    ui.getState().openDiagram('a');

    expect(ui.getState().openDiagramIds).toEqual(['a', 'b']);
    expect(ui.getState().activeDiagramId).toBe('a');
  });

  it('activates the last remaining tab when the active tab closes', () => {
    const { ui } = setup();
    ui.getState().openDiagram('a');
    ui.getState().openDiagram('b');

    ui.getState().closeDiagram('b');

    expect(ui.getState().openDiagramIds).toEqual(['a']);
    expect(ui.getState().activeDiagramId).toBe('a');
  });

  it('keeps the active tab when another tab closes', () => {
    const { ui } = setup();
    ui.getState().openDiagram('a');
    ui.getState().openDiagram('b');

    ui.getState().closeDiagram('a');

    expect(ui.getState().activeDiagramId).toBe('b');
  });

  it('collapses, re-expands and explicitly expands tree nodes', () => {
    const { ui } = setup();

    ui.getState().toggleCollapsed('n');
    expect(ui.getState().collapsedIds.has('n')).toBe(true);
    ui.getState().toggleCollapsed('n');
    expect(ui.getState().collapsedIds.has('n')).toBe(false);
    ui.getState().toggleCollapsed('n');
    ui.getState().expand('n');
    expect(ui.getState().collapsedIds.has('n')).toBe(false);
  });

  it('hides and shows panels independently', () => {
    const { ui } = setup();

    ui.getState().togglePanel('toolbox');
    ui.getState().togglePanel('properties');
    expect([...ui.getState().hiddenPanels].sort()).toEqual(['properties', 'toolbox']);

    ui.getState().togglePanel('toolbox');
    expect([...ui.getState().hiddenPanels]).toEqual(['properties']);
  });

  it('opens and closes the About dialog', () => {
    const { ui } = setup();
    expect(ui.getState().aboutOpen).toBe(false);

    ui.getState().openAbout();
    expect(ui.getState().aboutOpen).toBe(true);

    ui.getState().closeAbout();
    expect(ui.getState().aboutOpen).toBe(false);
  });

  describe('when the model changes', () => {
    it('clears the selection if the selected element was removed', () => {
      const { model, modelId, ui } = setup();
      const id = addElement(model, 'core:Package', modelId, 'Ordering');
      ui.getState().select(id);

      model.execute({ type: 'RemoveElement', id });

      expect(ui.getState().selectedId).toBeNull();
    });

    it('closes tabs of diagrams removed together with their package', () => {
      const { model, modelId, ui } = setup();
      const pkg = addElement(model, 'core:Package', modelId, 'Ordering');
      const diagram = addElement(model, 'uml:ClassDiagram', pkg, 'Overview');
      ui.getState().openDiagram(diagram);

      model.execute({ type: 'RemoveElement', id: pkg });

      expect(ui.getState().openDiagramIds).toEqual([]);
      expect(ui.getState().activeDiagramId).toBeNull();
    });

    it('closes the tab of a diagram whose creation is undone', () => {
      const { model, modelId, ui } = setup();
      const diagram = addElement(model, 'uml:ClassDiagram', modelId, 'Overview');
      ui.getState().openDiagram(diagram);

      model.undo();

      expect(ui.getState().openDiagramIds).toEqual([]);
    });

    it('stops following the model once unbound', () => {
      const { model, modelId, ui, unbind } = setup();
      const id = addElement(model, 'core:Package', modelId, 'Ordering');
      ui.getState().select(id);

      unbind();
      model.execute({ type: 'RemoveElement', id });

      expect(ui.getState().selectedId).toBe(id);
    });
  });
});
