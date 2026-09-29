import type { Notation } from '@dm/metamodel';
import { umlNotation } from '@dm/notation-uml';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PropertiesPanel } from './PropertiesPanel';
import { addElement, createActionContext } from './testing/fixture';

function renderPanel(notations?: readonly Notation[]) {
  const fixture = createActionContext(notations);
  render(<PropertiesPanel model={fixture.model} registry={fixture.registry} ui={fixture.ui} />);
  return { ...fixture, user: userEvent.setup() };
}

function selectNewClass(fixture: ReturnType<typeof renderPanel>): string {
  let id = '';
  act(() => {
    id = addElement(fixture.model, 'uml:Class', fixture.modelId, 'Order');
    fixture.ui.getState().select(id);
  });
  return id;
}

describe('PropertiesPanel', () => {
  it('says so when nothing is selected', () => {
    renderPanel();

    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
  });

  it('shows the kind, the name and the notation-defined properties with their defaults', () => {
    const fixture = renderPanel();
    selectNewClass(fixture);

    expect(screen.getByText('Class')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Order');
    expect(screen.getByLabelText('Abstract')).not.toBeChecked();
    expect(screen.getByLabelText('Visibility')).toHaveValue('public');
  });

  it('commits a rename on Enter as a single undo step', async () => {
    const fixture = renderPanel();
    const id = selectNewClass(fixture);

    await fixture.user.clear(screen.getByLabelText('Name'));
    await fixture.user.type(screen.getByLabelText('Name'), 'Purchase{Enter}');
    expect(fixture.model.getElement(id)?.name).toBe('Purchase');

    // One undo must fully revert the rename; a duplicate commit would leave "Purchase".
    act(() => {
      fixture.model.undo();
    });
    expect(fixture.model.getElement(id)?.name).toBe('Order');
  });

  it('commits a rename when the field loses focus', async () => {
    const fixture = renderPanel();
    const id = selectNewClass(fixture);

    await fixture.user.type(screen.getByLabelText('Name'), 'Line');
    await fixture.user.tab();

    expect(fixture.model.getElement(id)?.name).toBe('OrderLine');
  });

  it('reverts on Escape without committing', async () => {
    const fixture = renderPanel();
    const id = selectNewClass(fixture);
    const versionBefore = fixture.model.version;

    await fixture.user.type(screen.getByLabelText('Name'), 'Typo{Escape}');
    await fixture.user.tab();

    expect(screen.getByLabelText('Name')).toHaveValue('Order');
    expect(fixture.model.getElement(id)?.name).toBe('Order');
    expect(fixture.model.version).toBe(versionBefore);
  });

  it.each(['', '   '])('rejects the blank name %j by reverting the field', async (blank) => {
    const fixture = renderPanel();
    const id = selectNewClass(fixture);
    const versionBefore = fixture.model.version;

    await fixture.user.clear(screen.getByLabelText('Name'));
    if (blank !== '') await fixture.user.type(screen.getByLabelText('Name'), blank);
    await fixture.user.tab();

    expect(screen.getByLabelText('Name')).toHaveValue('Order');
    expect(fixture.model.getElement(id)?.name).toBe('Order');
    expect(fixture.model.version).toBe(versionBefore);
  });

  it('skips commits that do not change the value', async () => {
    const fixture = renderPanel();
    selectNewClass(fixture);
    const versionBefore = fixture.model.version;

    await fixture.user.click(screen.getByLabelText('Name'));
    await fixture.user.keyboard('{Enter}');
    await fixture.user.tab();

    expect(fixture.model.version).toBe(versionBefore);
  });

  it('commits checkbox and dropdown changes immediately', async () => {
    const fixture = renderPanel();
    const id = selectNewClass(fixture);

    await fixture.user.click(screen.getByLabelText('Abstract'));
    await fixture.user.selectOptions(screen.getByLabelText('Visibility'), 'private');

    expect(fixture.model.getElement(id)?.properties).toMatchObject({
      isAbstract: true,
      visibility: 'private',
    });
  });

  it('shows the model value again after an external undo', async () => {
    const fixture = renderPanel();
    selectNewClass(fixture);
    await fixture.user.selectOptions(screen.getByLabelText('Visibility'), 'private');
    await fixture.user.type(screen.getByLabelText('Name'), 'X{Enter}');

    act(() => {
      fixture.model.undo();
    });
    expect(screen.getByLabelText('Name')).toHaveValue('Order');

    act(() => {
      fixture.model.undo();
    });
    expect(screen.getByLabelText('Visibility')).toHaveValue('public');
  });

  it('uses a textarea for text properties, committing on blur rather than Enter', async () => {
    const notes: Notation = {
      id: 'notes',
      label: 'Notes',
      kinds: [
        {
          id: 'notes:Note',
          label: 'Note',
          icon: 'box',
          category: 'element',
          allowedOwners: ['core:Model'],
          properties: [
            { key: 'body', label: 'Body', type: 'text', default: '' },
            { key: 'author', label: 'Author', type: 'string', default: '' },
          ],
        },
      ],
    };
    const fixture = renderPanel([umlNotation, notes]);
    let id = '';
    act(() => {
      id = addElement(fixture.model, 'notes:Note', fixture.modelId, 'Memo');
      fixture.ui.getState().select(id);
    });

    const body = screen.getByLabelText('Body');
    expect(body.tagName).toBe('TEXTAREA');
    await fixture.user.type(body, 'line one{Enter}line two');
    expect(fixture.model.getElement(id)?.properties.body).toBe('');
    await fixture.user.tab();

    expect(fixture.model.getElement(id)?.properties.body).toBe('line one\nline two');
    expect(screen.getByLabelText('Author').tagName).toBe('INPUT');
  });
});
