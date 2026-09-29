import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AboutDialog } from './AboutDialog';
import { createUiStore } from './ui-store';

function renderAbout() {
  const ui = createUiStore();
  render(<AboutDialog ui={ui} />);
  return { ui, user: userEvent.setup() };
}

describe('AboutDialog', () => {
  it('is hidden until opened', () => {
    renderAbout();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the app name and its version', () => {
    const { ui } = renderAbout();

    act(() => {
      ui.getState().openAbout();
    });

    expect(screen.getByRole('dialog', { name: 'Data Modelling App' })).toHaveTextContent(
      /Version \d+\.\d+\.\d+/,
    );
  });

  it('closes with the Close button or Escape', async () => {
    const { ui, user } = renderAbout();
    act(() => {
      ui.getState().openAbout();
    });

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      ui.getState().openAbout();
    });
    await user.keyboard('{Escape}');
    expect(ui.getState().aboutOpen).toBe(false);
  });
});
