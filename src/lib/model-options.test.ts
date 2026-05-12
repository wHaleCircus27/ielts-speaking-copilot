import { describe, expect, it } from 'vitest';
import {
  asrModelOptions,
  getAsrModelOptions,
  getDefaultAsrModel,
  getDefaultLlmModel,
  getLlmModelOptions,
  isKnownAsrModel,
  isKnownLlmModel,
  llmModelOptions
} from './model-options';

describe('asr model options', () => {
  it('uses provider-specific defaults', () => {
    expect(getDefaultAsrModel('mock')).toBe('mock-transcript');
    expect(getDefaultAsrModel('openai')).toBe('gpt-4o-mini-transcribe');
    expect(getDefaultAsrModel('groq')).toBe('whisper-large-v3-turbo');
  });

  it('keeps ASR model selection constrained to known provider options', () => {
    const values = asrModelOptions.openai.map((option) => option.value);
    expect(values).toContain('gpt-4o-mini-transcribe');
    expect(getAsrModelOptions('groq').map((option) => option.value)).toContain('whisper-large-v3');
    expect(isKnownAsrModel('openai', 'gpt-4o-mini-transcribe')).toBe(true);
    expect(isKnownAsrModel('openai', 'whisper-large-v3')).toBe(false);
  });
});

describe('llm model options', () => {
  it('uses provider-specific defaults', () => {
    expect(getDefaultLlmModel('mock')).toBe('mock-feedback');
    expect(getDefaultLlmModel('nvidia')).toBe('meta/llama-3.3-70b-instruct');
  });

  it('includes verified NVIDIA API catalog model ids', () => {
    const values = llmModelOptions.nvidia.map((option) => option.value);
    expect(values).toContain('meta/llama-3.3-70b-instruct');
    expect(values).toContain('nvidia/nemotron-3-super-120b-a12b');
    expect(values).toContain('openai/gpt-oss-120b');
  });

  it('keeps model selection constrained to known provider options', () => {
    const options = getLlmModelOptions('nvidia');
    expect(options.some((option) => option.value === 'custom/provider-model')).toBe(false);
    expect(isKnownLlmModel('nvidia', 'meta/llama-3.3-70b-instruct')).toBe(true);
    expect(isKnownLlmModel('nvidia', 'custom/provider-model')).toBe(false);
  });
});
