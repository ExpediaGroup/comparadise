import * as React from 'react';
import 'react-medium-image-zoom/dist/styles.css';
import './App.css';
import { Main } from './components/Main';
import { ClientProvider } from './providers/ClientProvider';
import { QueryParamProvider } from 'use-query-params';

function App() {
  return (
    <ClientProvider>
      <QueryParamProvider>
        <Main />
      </QueryParamProvider>
    </ClientProvider>
  );
}

export default App;
