import { Model } from '@dm/core';
import { Registry } from '@dm/metamodel';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('shows the name of every element in the model', () => {
    const model = new Model(Registry.create([]));

    render(<App model={model} />);

    expect(screen.getByText('Untitled Project')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
  });
});
