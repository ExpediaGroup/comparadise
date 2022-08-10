import * as React from 'react';
import 'react-medium-image-zoom/dist/styles.css';
import './App.css';
import { Main } from './components/Main';
import { ClientProvider } from './providers/ClientProvider';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter6Adapter } from 'use-query-params/adapters/react-router-6';

function App() {
  return (
    <ClientProvider>
      <QueryParamProvider adapter={ReactRouter6Adapter}>
        <Main />
      </QueryParamProvider>
    </ClientProvider>
  );
}

export default App;
