import {
  Button,
  Description,
  Input,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalHeading,
  type useOverlayState,
} from '@heroui/react';
import { useState } from 'react';

import {
  type ModelSettings,
  PROVIDER_DEFAULTS,
  type ProviderKind,
  useModelSettingsStore,
} from '../../domain/model-settings';

type Props = {
  state: ReturnType<typeof useOverlayState>;
  mode: 'onboarding' | 'edit';
};

const PROVIDER_ORDER: ProviderKind[] = ['openai', 'anthropic'];

export function ProviderSettingsModal({ state, mode }: Props) {
  const current = useModelSettingsStore((s) => s.settings);
  const save = useModelSettingsStore((s) => s.save);

  const initial: ModelSettings = current ?? {
    provider: 'openai',
    baseURL: PROVIDER_DEFAULTS.openai.baseURL,
    model: PROVIDER_DEFAULTS.openai.defaultModel,
  };

  const [provider, setProvider] = useState<ProviderKind>(initial.provider);
  const [baseURL, setBaseURL] = useState(initial.baseURL);
  const [apiKey, setApiKey] = useState(initial.apiKey ?? '');
  const [model, setModel] = useState(
    initial.model ?? PROVIDER_DEFAULTS[initial.provider].defaultModel
  );

  // When the edit-mode modal reopens, sync local form state to whatever is in the store.
  // React-recommended pattern for derived state — adjust during render instead of useEffect.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [wasOpen, setWasOpen] = useState(state.isOpen);
  if (state.isOpen !== wasOpen) {
    setWasOpen(state.isOpen);
    if (mode === 'edit' && state.isOpen && current) {
      setProvider(current.provider);
      setBaseURL(current.baseURL);
      setApiKey(current.apiKey ?? '');
      setModel(current.model ?? '');
    }
  }

  function onChangeProvider(next: ProviderKind) {
    // If the URL or model still match the OTHER provider's defaults, follow the switch.
    // If the user has edited either, leave it alone.
    if (baseURL === PROVIDER_DEFAULTS[provider].baseURL) {
      setBaseURL(PROVIDER_DEFAULTS[next].baseURL);
    }
    if (model === PROVIDER_DEFAULTS[provider].defaultModel) {
      setModel(PROVIDER_DEFAULTS[next].defaultModel);
    }
    setProvider(next);
  }

  const canSubmit = baseURL.trim().length > 0;

  function onSubmit() {
    if (!canSubmit) return;
    const next: ModelSettings = {
      provider,
      baseURL: baseURL.trim(),
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      ...(model.trim() ? { model: model.trim() } : {}),
    };
    save(next);
    if (mode === 'edit') state.close();
  }

  const isOnboarding = mode === 'onboarding';

  return (
    <Modal state={state}>
      <ModalBackdrop
        className="app-modal-backdrop"
        isDismissable={!isOnboarding}
        isKeyboardDismissDisabled={isOnboarding}
      >
        <ModalContainer placement="center" size="md">
          <ModalDialog>
            <ModalHeader>
              <ModalHeading className="text-base font-semibold">
                {isOnboarding ? 'Connect a model' : 'Model settings'}
              </ModalHeading>
            </ModalHeader>
            <ModalBody className="flex flex-col gap-4 p-1">
              <p className="text-xs text-neutral-400">
                This demo runs entirely in your browser. Your key is stored in local storage and
                sent only to the endpoint you configure.
              </p>
              <p className="text-xs text-neutral-500">
                Running a local model (LM Studio, Ollama)? Expose it through an HTTPS tunnel like{' '}
                <a
                  href="https://ngrok.com"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-neutral-300"
                >
                  ngrok
                </a>{' '}
                or{' '}
                <a
                  href="https://github.com/cloudflare/cloudflared"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-neutral-300"
                >
                  cloudflared
                </a>{' '}
                — browsers block HTTPS pages from calling HTTP endpoints.
              </p>

              <section className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                  Provider
                </span>
                <div className="inline-flex rounded border border-neutral-800 p-0.5">
                  {PROVIDER_ORDER.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => onChangeProvider(kind)}
                      className={[
                        'flex-1 cursor-pointer rounded px-2 py-1 text-xs transition-colors',
                        kind === provider
                          ? 'bg-neutral-700 text-neutral-100'
                          : 'text-neutral-400 hover:text-neutral-200',
                      ].join(' ')}
                    >
                      {PROVIDER_DEFAULTS[kind].label}
                    </button>
                  ))}
                </div>
              </section>

              <LabeledField label="Base URL">
                <Input
                  variant="secondary"
                  value={baseURL}
                  onChange={(e) => setBaseURL(e.target.value)}
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                />
              </LabeledField>

              <LabeledField label="API Key">
                <Input
                  type="password"
                  variant="secondary"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                />
                <Description id="api-key-description">Optional for local proxies</Description>
              </LabeledField>

              <LabeledField label="Model">
                <Input
                  placeholder={PROVIDER_DEFAULTS[provider].defaultModel}
                  variant="secondary"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                />
                <Description id="api-key-description">Optional for local proxies</Description>
              </LabeledField>

              <div className="flex justify-end gap-2 pt-2">
                {!isOnboarding && (
                  <Button size="sm" variant="ghost" onPress={() => state.close()}>
                    Cancel
                  </Button>
                )}
                <Button size="sm" variant="primary" onPress={onSubmit} isDisabled={!canSubmit}>
                  {isOnboarding ? 'Connect' : 'Save and Connect'}
                </Button>
              </div>
            </ModalBody>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">{label}</span>
      {children}
    </label>
  );
}
