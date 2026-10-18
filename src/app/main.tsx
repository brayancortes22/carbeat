import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { AppRoot } from './AppRoot';
import { native } from './native';
import '../index.css';
import './app.css';

void native.boot();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppRoot />
    </ErrorBoundary>
  </StrictMode>,
);
