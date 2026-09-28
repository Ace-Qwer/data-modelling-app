import { Model } from '@dm/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('shows the name of every element in the model', () => {
    const model = new Model();
    model.execute({
      type: 'AddElement',
      element: { id: '01J9Z8Q4X7M2N5P6R8S0T1V3W4', kind: 'uml:Class', name: 'Order' },
    });
    model.execute({
      type: 'AddElement',
      element: { id: '01J9Z8Q4X7M2N5P6R8S0T1V3W5', kind: 'uml:Class', name: 'Customer' },
    });

    render(<App model={model} />);

    expect(screen.getByText('Order')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
  });
});
