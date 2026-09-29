import { Model } from '@dm/core';
import { Registry } from '@dm/metamodel';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const model = new Model(Registry.create([]));

const root = document.getElementById('root');
if (!root) throw new Error('index.html is missing the #root element');

createRoot(root).render(
  <StrictMode>
    <App model={model} />
  </StrictMode>,
);
