import { describe, expect, it } from 'vitest';
import { getDefaultLlmModel, getLlmModelOptions, isKnownLlmModel, llmModelOptions } from './model-options';

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
    const options = getLlmModelOptions('nvidia', 'custom/provider-model');
    expect(options.some((option) => option.value === 'custom/provider-model')).toBe(false);
    expect(isKnownLlmModel('nvidia', 'meta/llama-3.3-70b-instruct')).toBe(true);
    expect(isKnownLlmModel('nvidia', 'custom/provider-model')).toBe(false);
  });
});
