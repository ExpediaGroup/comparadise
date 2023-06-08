import * as React from 'react';
import './App.css';
import { MainPage } from './components/main-page';
import { ClientProvider } from './providers/client-provider';
import { QueryParamProvider } from 'use-query-params';
import { WindowHistoryAdapter } from 'use-query-params/adapters/window';
import { BaseImageStateProvider } from './providers/base-image-state-provider';

function App({ queryParamAdapter = WindowHistoryAdapter }) {
  return (
    <ClientProvider>
      <QueryParamProvider adapter={queryParamAdapter}>
        <BaseImageStateProvider>
          <MainPage />
        </BaseImageStateProvider>
      </QueryParamProvider>
    </ClientProvider>
  );
}

export default App;
