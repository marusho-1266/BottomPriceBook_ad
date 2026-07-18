import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import { App } from './App';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import { initSentry } from './lib/sentry';

initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-cream px-6 text-center">
          <p className="text-sm font-bold text-ink-sub">
            予期しないエラーが発生しました。ページを再読み込みしてください。
          </p>
        </div>
      }
    >
      <App />
      <PwaUpdatePrompt />
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
