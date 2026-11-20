import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Resolve the theme before the first React paint so the shell never flashes
// (or paints a stale dark layer) when a light theme is persisted.
try {
  const raw = localStorage.getItem('tessera.settings.v1');
  const stored = raw ? (JSON.parse(raw) as { theme?: string; accent?: string }) : {};
  const param = new URLSearchParams(window.location.search).get('theme');
  const preferred =
    param === 'light' || param === 'dark'
      ? param
      : stored.theme === 'light' || stored.theme === 'dark'
        ? stored.theme
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
  document.documentElement.dataset.theme = preferred;
  if (stored.accent) document.documentElement.dataset.accent = stored.accent;
} catch {
  // localStorage may be unavailable in private mode.
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Offline caching is optional; ignore failures on unsupported origins.
    });
  });
}
