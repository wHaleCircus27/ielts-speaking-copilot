import { describe, expect, it } from 'vitest';
import { defaultSettings } from './storage';
import { describeMissingConfig, getSettingsReadiness } from './settings-validation';
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

describe('settings readiness', () => {
  it('treats mock ASR and LLM as ready without API keys', () => {
    const readiness = getSettingsReadiness(defaultSettings);
    expect(readiness.asr.ready).toBe(true);
    expect(readiness.llm.ready).toBe(true);
    expect(readiness.ready).toBe(true);
  });

  it('requires ASR model and provider API key before transcription', () => {
    const readiness = getSettingsReadiness(settingsWith({
      asrProvider: 'openai',
      asrModel: '',
      apiKeys: { openai: '', groq: '', gemini: '', nvidia: '' }
    }));

    expect(readiness.asr.ready).toBe(false);
    expect(readiness.asr.missing).toEqual(['ASR model', 'OPENAI API Key']);
    expect(readiness.llm.ready).toBe(true);
    expect(readiness.ready).toBe(false);
  });

  it('requires NVIDIA API key before NVIDIA ASR transcription', () => {
    const readiness = getSettingsReadiness(settingsWith({
      asrProvider: 'nvidia',
      asrModel: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
      apiKeys: { openai: '', groq: '', gemini: '', nvidia: '' }
    }));

    expect(readiness.asr.ready).toBe(false);
    expect(readiness.asr.missing).toEqual(['NVIDIA API Key']);
  });

  it('requires LLM model and provider API key before feedback generation', () => {
    const readiness = getSettingsReadiness(settingsWith({
      llmProvider: 'gemini',
      llmModel: '',
      apiKeys: { openai: '', groq: '', gemini: '', nvidia: '' }
    }));

    expect(readiness.asr.ready).toBe(true);
    expect(readiness.llm.ready).toBe(false);
    expect(readiness.llm.missing).toEqual(['LLM model', 'GEMINI API Key']);
  });

  it('describes missing config in the active UI language', () => {
    const readiness = getSettingsReadiness(settingsWith({
      asrProvider: 'groq',
      apiKeys: { openai: '', groq: '', gemini: '', nvidia: '' }
    }));

    expect(describeMissingConfig(readiness.asr, 'ASR', 'zh')).toContain('ASR 配置不完整');
    expect(describeMissingConfig(readiness.asr, 'ASR', 'en')).toContain('ASR configuration is incomplete');
  });
});
