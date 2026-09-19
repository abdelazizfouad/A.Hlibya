import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const nativeFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(requestUrl, window.location.origin);

  if (url.pathname.startsWith('/api/')) {
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    headers.set('bypass-tunnel-reminder', 'true');
    return nativeFetch(input, { ...init, headers });
  }

  return nativeFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
