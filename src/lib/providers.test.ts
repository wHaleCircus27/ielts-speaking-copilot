import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeTranscriptionResponse,
  parseSseEvent,
  readErrorMessage,
  ProviderError,
  testLlmProviderConnection
} from './providers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeTranscriptionResponse', () => {
  it('normalizes timestamped provider segments', () => {
    expect(
      normalizeTranscriptionResponse({
        segments: [
          { id: 7, start: 1.2, end: 4.5, text: ' hello ' },
          { start: 5, end: 6, text: '   ' }
        ]
      })
    ).toEqual([{ id: '7', start: 1.2, end: 4.5, text: 'hello' }]);
  });

  it('falls back to one segment for text-only responses', () => {
    expect(normalizeTranscriptionResponse({ text: 'Full transcript' })).toEqual([
      { id: 'segment-1', start: 0, end: 0, text: 'Full transcript' }
    ]);
  });

  it('throws a readable error for empty ASR responses', () => {
    expect(() => normalizeTranscriptionResponse({ segments: [] })).toThrow(ProviderError);
  });
});

describe('parseSseEvent', () => {
  it('extracts text chunks from SSE data lines', () => {
    const chunks = parseSseEvent('data: {"delta":"Hello"}\n\ndata: [DONE]', (event) =>
      typeof event.delta === 'string' ? event.delta : ''
    );

    expect(chunks).toEqual(['Hello']);
  });

  it('maps malformed SSE data to ProviderError', () => {
    expect(() => parseSseEvent('data: not-json', () => '')).toThrow(ProviderError);
  });
});

describe('readErrorMessage', () => {
  it('includes provider status and JSON error details', async () => {
    const response = new Response(JSON.stringify({ error: { message: 'bad key' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });

    const message = await readErrorMessage(response);
    expect(message).toContain('401');
    expect(message).toContain('bad key');
  });
});

describe('testLlmProviderConnection', () => {
  it('checks the selected NVIDIA model through chat completions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

    await testLlmProviderConnection('nvidia', 'nvapi-test', 'meta/llama-3.3-70b-instruct');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer nvapi-test',
          'Content-Type': 'application/json'
        }),
        body: expect.stringContaining('meta/llama-3.3-70b-instruct')
      })
    );
  });
});
