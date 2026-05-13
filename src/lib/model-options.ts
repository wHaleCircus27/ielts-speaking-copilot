import type { AsrProvider, LlmProvider } from './types';

export type ModelOption = {
  label: string;
  value: string;
};

export const recommendedNvidiaLlmModel = 'deepseek-ai/deepseek-v4-flash';
export const recommendedDeepseekLlmModel = 'deepseek-v4-flash';

const legacyNvidiaLlmModelsToMigrate = new Set([
  'meta/llama-3.3-70b-instruct',
  'deepseek-ai/deepseek-v4-pro'
]);

export const llmModelOptions: Record<LlmProvider, ModelOption[]> = {
  mock: [{ label: 'Mock feedback', value: 'mock-feedback' }],
  openai: [
    { label: 'GPT-4o mini', value: 'gpt-4o-mini' },
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'GPT-4.1 mini', value: 'gpt-4.1-mini' },
    { label: 'GPT-4.1', value: 'gpt-4.1' }
  ],
  groq: [
    { label: 'Llama 3.3 70B Versatile', value: 'llama-3.3-70b-versatile' },
    { label: 'Llama 3.1 8B Instant', value: 'llama-3.1-8b-instant' },
    { label: 'Mixtral 8x7B', value: 'mixtral-8x7b-32768' },
    { label: 'Gemma 2 9B', value: 'gemma2-9b-it' }
  ],
  gemini: [
    { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
    { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' }
  ],
  nvidia: [
    { label: 'DeepSeek V4 Flash', value: recommendedNvidiaLlmModel },
    { label: 'Llama 3.3 70B Instruct', value: 'meta/llama-3.3-70b-instruct' },
    { label: 'Llama 4 Maverick 17B 128E', value: 'meta/llama-4-maverick-17b-128e-instruct' },
    { label: 'Nemotron Super 49B v1.5', value: 'nvidia/llama-3.3-nemotron-super-49b-v1.5' },
    { label: 'Nemotron Super 120B A12B', value: 'nvidia/nemotron-3-super-120b-a12b' },
    { label: 'Mistral Large 3 675B', value: 'mistralai/mistral-large-3-675b-instruct-2512' },
    { label: 'DeepSeek V4 Pro', value: 'deepseek-ai/deepseek-v4-pro' },
    { label: 'GPT OSS 120B', value: 'openai/gpt-oss-120b' },
    { label: 'GPT OSS 20B', value: 'openai/gpt-oss-20b' }
  ],
  deepseek: [
    { label: 'DeepSeek V4 Flash', value: recommendedDeepseekLlmModel },
    { label: 'DeepSeek V4 Pro', value: 'deepseek-v4-pro' }
  ]
};

export const asrModelOptions: Record<AsrProvider, ModelOption[]> = {
  mock: [{ label: 'Mock transcript', value: 'mock-transcript' }],
  openai: [
    { label: 'GPT-4o mini transcribe', value: 'gpt-4o-mini-transcribe' },
    { label: 'GPT-4o transcribe', value: 'gpt-4o-transcribe' },
    { label: 'Whisper 1', value: 'whisper-1' }
  ],
  groq: [
    { label: 'Whisper Large v3 Turbo', value: 'whisper-large-v3-turbo' },
    { label: 'Whisper Large v3', value: 'whisper-large-v3' },
    { label: 'Distil Whisper Large v3 EN', value: 'distil-whisper-large-v3-en' }
  ],
  nvidia: [
    { label: 'Nemotron 3 Nano Omni 30B', value: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' }
  ]
};

export function getDefaultAsrModel(provider: AsrProvider): string {
  return asrModelOptions[provider][0].value;
}

export function getAsrModelOptions(provider: AsrProvider): ModelOption[] {
  return asrModelOptions[provider];
}

export function getDefaultLlmModel(provider: LlmProvider): string {
  return llmModelOptions[provider][0].value;
}

export function normalizeLlmModel(provider: LlmProvider, model: string): string {
  const trimmed = model.trim();
  if (provider === 'nvidia' && legacyNvidiaLlmModelsToMigrate.has(trimmed)) {
    return recommendedNvidiaLlmModel;
  }

  return isKnownLlmModel(provider, trimmed) ? trimmed : getDefaultLlmModel(provider);
}

export function getLlmModelOptions(provider: LlmProvider): ModelOption[] {
  return llmModelOptions[provider];
}

export function isKnownAsrModel(provider: AsrProvider, model: string): boolean {
  return asrModelOptions[provider].some((option) => option.value === model.trim());
}

export function isKnownLlmModel(provider: LlmProvider, model: string): boolean {
  return llmModelOptions[provider].some((option) => option.value === model.trim());
}
