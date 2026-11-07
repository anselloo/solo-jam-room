import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './registerServiceWorker';
import '@fontsource-variable/funnel-sans/wght.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/games.css';
import './styles/home.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
