import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { WebApp } from './web/WebApp';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <WebApp />
    </ErrorBoundary>
  </StrictMode>,
);
