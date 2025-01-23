import React from 'react';
import { App } from './app';

import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

document.addEventListener('DOMContentLoaded', () => {
  const root = createRoot(document.getElementById('root')!);
  root.render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
});
