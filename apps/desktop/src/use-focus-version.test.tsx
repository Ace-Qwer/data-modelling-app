import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFocusVersion } from './use-focus-version';

function Probe() {
  return <output>{useFocusVersion()}</output>;
}

describe('useFocusVersion', () => {
  it('changes whenever focus moves into or out of an element', () => {
    render(
      <>
        <Probe />
        <input aria-label="field" />
      </>,
    );
    const before = screen.getByRole('status').textContent;

    act(() => {
      screen.getByLabelText('field').focus();
    });
    const focused = screen.getByRole('status').textContent;
    act(() => {
      screen.getByLabelText('field').blur();
    });

    expect(focused).not.toBe(before);
    expect(screen.getByRole('status').textContent).not.toBe(focused);
  });
});
