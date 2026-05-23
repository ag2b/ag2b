import { Ag2bProvider } from '@ag2b/react';
import { Ag2bPopup } from '@ag2b/react-chat';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { agent } from './agent';
import { App } from './App';

import '@ag2b/react-chat/styles.css';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <Ag2bProvider agent={agent}>
      <App />
      <Ag2bPopup mode="streaming" showReasoning showModeToggle />
    </Ag2bProvider>
  </StrictMode>
);
