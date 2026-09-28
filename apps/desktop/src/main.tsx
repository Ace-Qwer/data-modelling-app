import { Model } from '@dm/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ulid } from 'ulid';
import { App } from './App';

const model = new Model();
model.execute({ type: 'AddElement', element: { id: ulid(), kind: 'uml:Class', name: 'Order' } });

const root = document.getElementById('root');
if (!root) throw new Error('index.html is missing the #root element');

createRoot(root).render(
  <StrictMode>
    <App model={model} />
  </StrictMode>,
);
