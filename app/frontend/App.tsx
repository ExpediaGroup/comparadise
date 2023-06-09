import * as React from 'react';
import './App.css';
import { MainPage } from './components/main-page';
import { ClientProvider } from './providers/client-provider';
import { BaseImageStateProvider } from './providers/base-image-state-provider';

function App() {
  return (
    <ClientProvider>
      <BaseImageStateProvider>
        <MainPage />
      </BaseImageStateProvider>
    </ClientProvider>
  );
}

export default App;
