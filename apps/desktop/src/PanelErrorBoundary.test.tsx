import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PanelErrorBoundary } from './PanelErrorBoundary';

function Broken(): never {
  throw new Error('boom');
}

describe('PanelErrorBoundary', () => {
  it('replaces a crashed panel with a message instead of blanking the app', () => {
    // React logs caught render errors; silence that expected noise.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <div>
        <PanelErrorBoundary>
          <Broken />
        </PanelErrorBoundary>
        <p>Sibling panel</p>
      </div>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong in this panel');
    expect(screen.getByText('Sibling panel')).toBeInTheDocument();
  });

  it('renders its children when nothing fails', () => {
    render(
      <PanelErrorBoundary>
        <p>Healthy</p>
      </PanelErrorBoundary>,
    );

    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });
});
