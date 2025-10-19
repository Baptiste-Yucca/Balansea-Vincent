import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { initZendesk } from '@/lib/zendesk';

import { env } from '@/config/env';

// Initialize Zendesk support widget
initZendesk();

const { VITE_BACKEND_URL, VITE_IS_DEVELOPMENT, VITE_SENTRY_DSN, VITE_SENTRY_FILTER } = env;

if (VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: VITE_SENTRY_DSN,
    enabled: !VITE_IS_DEVELOPMENT,
    sendDefaultPii: true,
    tracesSampleRate: 1.0,
    tracePropagationTargets: [VITE_BACKEND_URL],
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.thirdPartyErrorFilterIntegration({
        behaviour: 'drop-error-if-contains-third-party-frames',
        filterKeys: [VITE_SENTRY_FILTER],
      }),
    ],
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
