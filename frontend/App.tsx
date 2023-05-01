import * as React from 'react';
import './App.css';
import { Main } from './components/Main';
import { ClientProvider } from './providers/ClientProvider';
import { QueryParamProvider } from 'use-query-params';
import { WindowHistoryAdapter } from 'use-query-params/adapters/window';

function App({ queryParamAdapter = WindowHistoryAdapter }) {
  return (
    <ClientProvider>
      <QueryParamProvider adapter={queryParamAdapter}>
        <Main />
      </QueryParamProvider>
    </ClientProvider>
  );
}

export default App;
