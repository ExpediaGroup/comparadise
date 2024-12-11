/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App, OuterHtml } from './app';

hydrateRoot(
  document,
  <BrowserRouter>
    <OuterHtml>
      <App />
    </OuterHtml>
  </BrowserRouter>
);
