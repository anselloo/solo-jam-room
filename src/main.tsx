import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './registerServiceWorker';
import '@fontsource/bebas-neue/latin-400.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/games.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
