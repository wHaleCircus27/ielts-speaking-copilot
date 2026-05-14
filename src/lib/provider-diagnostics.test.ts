import { describe, expect, it } from 'vitest';
import { buildProviderDiagnostics, hasConfiguredProviderKey } from './provider-diagnostics';
import { getSettingsReadiness } from './settings-validation';
import { defaultSettings } from './storage';
import type { AppSettings } from './types';

function settingsWith(overrides: Partial<AppSettings>): AppSettings {
  return {
    ...defaultSettings,
    ...overrides,
    apiKeys: {
      ...defaultSettings.apiKeys,
      ...overrides.apiKeys
    },
    appearance: {
      ...defaultSettings.appearance,
      ...overrides.appearance
    },
    limits: {
      ...defaultSettings.limits,
      ...overrides.limits
    }
  };
}

describe('provider diagnostics', () => {
  it('marks mock ASR and LLM ready without API keys', () => {
    const diagnostics = buildProviderDiagnostics(
      defaultSettings,
      getSettingsReadiness(defaultSettings),
      { isDesktop: false },
      new Date('2026-05-14T00:00:00.000Z')
    );

    expect(diagnostics.find((item) => item.capability === 'ASR')?.ready).toBe(true);
    expect(diagnostics.find((item) => item.capability === 'LLM')?.ready).toBe(true);
    expect(diagnostics.find((item) => item.capability === 'Runtime')?.ready).toBe(false);
    expect(diagnostics[0].checkedAt).toBe('2026-05-14T00:00:00.000Z');
  });

  it('reports missing model and API key without exposing secrets', () => {
    const settings = settingsWith({
      llmProvider: 'deepseek',
      llmModel: '',
      apiKeys: { openai: '', groq: '', gemini: '', nvidia: '', deepseek: '' }
    });
    const diagnostics = buildProviderDiagnostics(
      settings,
      getSettingsReadiness(settings),
      { isDesktop: true },
      new Date('2026-05-14T00:00:00.000Z')
    );
    const llm = diagnostics.find((item) => item.capability === 'LLM');

    expect(llm?.ready).toBe(false);
    expect(llm?.message).toContain('LLM model');
    expect(llm?.message).toContain('DEEPSEEK API Key');
    expect(JSON.stringify(diagnostics)).not.toContain('sk-');
  });

  it('reports real providers ready when model and key are configured', () => {
    const settings = settingsWith({
      asrProvider: 'openai',
      asrModel: 'gpt-4o-mini-transcribe',
      llmProvider: 'deepseek',
      llmModel: 'deepseek-v4-flash',
      apiKeys: { openai: 'sk-openai-test', groq: '', gemini: '', nvidia: '', deepseek: 'sk-deepseek-test' }
    });
    const diagnostics = buildProviderDiagnostics(
      settings,
      getSettingsReadiness(settings),
      { isDesktop: true },
      new Date('2026-05-14T00:00:00.000Z')
    );

    expect(diagnostics.find((item) => item.capability === 'ASR')?.ready).toBe(true);
    expect(diagnostics.find((item) => item.capability === 'LLM')?.ready).toBe(true);
    expect(diagnostics.find((item) => item.capability === 'Storage')?.ready).toBe(true);
    expect(hasConfiguredProviderKey(settings, 'deepseek')).toBe(true);
  });
});
