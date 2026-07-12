import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PwaUpdatePrompt />
  </StrictMode>,
);
