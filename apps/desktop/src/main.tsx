import { Model } from '@dm/core';
import { Registry } from '@dm/metamodel';
import { umlNotation } from '@dm/notation-uml';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Shell } from './Shell';

const registry = Registry.create([umlNotation]);

const root = document.getElementById('root');
if (!root) throw new Error('index.html is missing the #root element');

createRoot(root).render(
  <StrictMode>
    <Shell registry={registry} createModel={() => new Model(registry)} />
  </StrictMode>,
);
