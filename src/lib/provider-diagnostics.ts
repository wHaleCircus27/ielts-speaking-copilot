import { getProviderApiKey } from './providers';
import type { SettingsReadiness } from './settings-validation';
import type { AppSettings, AsrProvider, LlmProvider } from './types';

export type ProviderDiagnosticCapability = 'ASR' | 'LLM' | 'Runtime' | 'Storage';

export type ProviderDiagnosticResult = {
  capability: ProviderDiagnosticCapability;
  provider: AsrProvider | LlmProvider | 'desktop';
  model: string;
  ready: boolean;
  message: string;
  checkedAt: string;
};

type RuntimeProbe = {
  isDesktop: boolean;
};

export function buildProviderDiagnostics(
  settings: AppSettings,
  readiness: SettingsReadiness,
  runtime: RuntimeProbe,
  now = new Date()
): ProviderDiagnosticResult[] {
  const checkedAt = now.toISOString();

  return [
    buildCapabilityDiagnostic('ASR', settings.asrProvider, settings.asrModel, readiness.asr, checkedAt),
    buildCapabilityDiagnostic('LLM', settings.llmProvider, settings.llmModel, readiness.llm, checkedAt),
    {
      capability: 'Runtime',
      provider: 'desktop',
      model: 'Tauri HTTP',
      ready: runtime.isDesktop,
      message: runtime.isDesktop
        ? 'Desktop runtime detected; real provider requests can use the Tauri HTTP plugin.'
        : 'Web runtime detected; use the desktop shell for real provider HTTP requests.',
      checkedAt
    },
    {
      capability: 'Storage',
      provider: 'desktop',
      model: 'OS keyring',
      ready: runtime.isDesktop,
      message: runtime.isDesktop
        ? 'Desktop secure credential storage is available for API keys.'
        : 'Secure credential storage is available only in the desktop shell.',
      checkedAt
    }
  ];
}

function buildCapabilityDiagnostic(
  capability: 'ASR' | 'LLM',
  provider: AsrProvider | LlmProvider,
  model: string,
  readiness: { ready: boolean; missing: string[] },
  checkedAt: string
): ProviderDiagnosticResult {
  const needsKey = provider !== 'mock';
  const missing = readiness.missing.join(', ');

  return {
    capability,
    provider,
    model: model || 'unset',
    ready: readiness.ready,
    message: readiness.ready
      ? `${provider === 'mock' ? 'Mock provider' : `${provider.toUpperCase()} provider`} is ready.`
      : `${capability} missing: ${missing || (needsKey ? 'model or API key' : 'model')}.`,
    checkedAt
  };
}

export function hasConfiguredProviderKey(settings: AppSettings, provider: AsrProvider | LlmProvider): boolean {
  return provider === 'mock' || Boolean(getProviderApiKey(settings, provider));
}
