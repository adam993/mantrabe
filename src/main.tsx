import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';

const rootEl = document.getElementById('app');
if (!rootEl) throw new Error('#app element not found in index.html');
createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
