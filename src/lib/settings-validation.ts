import { getProviderApiKey, needsAsrKey, needsLlmKey } from './providers';
import type { AppSettings } from './types';

export type CapabilityReadiness = {
  ready: boolean;
  missing: string[];
};

export type SettingsReadiness = {
  asr: CapabilityReadiness;
  llm: CapabilityReadiness;
  ready: boolean;
};

export function getAsrReadiness(settings: AppSettings): CapabilityReadiness {
  const missing: string[] = [];

  if (!settings.asrModel.trim()) {
    missing.push('ASR model');
  }

  if (needsAsrKey(settings) && !getProviderApiKey(settings, settings.asrProvider)) {
    missing.push(`${settings.asrProvider.toUpperCase()} API Key`);
  }

  return {
    ready: missing.length === 0,
    missing
  };
}

export function getLlmReadiness(settings: AppSettings): CapabilityReadiness {
  const missing: string[] = [];

  if (!settings.llmModel.trim()) {
    missing.push('LLM model');
  }

  if (needsLlmKey(settings) && !getProviderApiKey(settings, settings.llmProvider)) {
    missing.push(`${settings.llmProvider.toUpperCase()} API Key`);
  }

  return {
    ready: missing.length === 0,
    missing
  };
}

export function getSettingsReadiness(settings: AppSettings): SettingsReadiness {
  const asr = getAsrReadiness(settings);
  const llm = getLlmReadiness(settings);

  return {
    asr,
    llm,
    ready: asr.ready && llm.ready
  };
}

export function describeMissingConfig(
  readiness: CapabilityReadiness,
  capability: 'ASR' | 'LLM',
  language: AppSettings['appearance']['language']
): string {
  if (readiness.ready) {
    return '';
  }

  const missing = readiness.missing.join(', ');
  return language === 'zh'
    ? `${capability} 配置不完整：${missing}。请先到设置页补齐。`
    : `${capability} configuration is incomplete: ${missing}. Complete it in Settings first.`;
}
