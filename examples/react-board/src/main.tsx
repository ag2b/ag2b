import { Ag2bProvider } from '@ag2b/react';
import { Ag2bPopup } from '@ag2b/react-chat';
import { useOverlayState } from '@heroui/react';
import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

import { createBoardAgent } from './agent';
import { App } from './App';
import { ProviderSettingsModal } from './components/provider/ProviderSettingsModal';
import { type ModelSettings, useModelSettingsStore } from './domain/model-settings';

import '@ag2b/react-chat/styles.css';
import './styles.css';

function Root() {
  const settings = useModelSettingsStore((s) => s.settings);
  const onboardingState = useOverlayState({ defaultOpen: true });

  if (!settings) {
    return <ProviderSettingsModal state={onboardingState} mode="onboarding" />;
  }
  return <ConfiguredApp settings={settings} />;
}

function ConfiguredApp({ settings }: { settings: ModelSettings }) {
  const settingsKey = JSON.stringify(settings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const agent = useMemo(() => createBoardAgent(settings), [settingsKey]);

  return (
    <Ag2bProvider agent={agent} key={settingsKey}>
      <App />
      <Ag2bPopup mode="streaming" showReasoning showModeToggle showClearChat />
    </Ag2bProvider>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
