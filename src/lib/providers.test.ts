import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeTranscriptionResponse,
  normalizeNvidiaTranscriptionText,
  parseSseEvent,
  readErrorMessage,
  ProviderError,
  transcribeAudio,
  testLlmProviderConnection
} from './providers';
import { defaultSettings } from './storage';

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

describe('normalizeNvidiaTranscriptionText', () => {
  it('normalizes NVIDIA ASR text into a single media-length segment', () => {
    expect(normalizeNvidiaTranscriptionText('Transcript: I would like to discuss education.', 12.5)).toEqual([
      {
        id: 'segment-1',
        start: 0,
        end: 12.5,
        text: 'I would like to discuss education.'
      }
    ]);
  });

  it('throws a readable error for empty NVIDIA ASR output', () => {
    expect(() => normalizeNvidiaTranscriptionText(' ', 10)).toThrow(ProviderError);
  });
});

describe('NVIDIA ASR', () => {
  it('sends audio to NVIDIA chat completions and converts the transcript', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: 'This is my speaking answer.' } }]
      }), { status: 200 })
    );
    const file = new File(['demo audio'], 'answer.wav', { type: 'audio/wav' });
    const settings = {
      ...defaultSettings,
      asrProvider: 'nvidia' as const,
      asrModel: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
      apiKeys: {
        openai: '',
        groq: '',
        gemini: '',
        nvidia: 'nvapi-test'
      }
    };

    const segments = await transcribeAudio(file, settings, 9);

    expect(segments).toEqual([{ id: 'segment-1', start: 0, end: 9, text: 'This is my speaking answer.' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer nvapi-test',
          'Content-Type': 'application/json'
        }),
        body: expect.stringContaining('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning')
      })
    );
    expect(fetchMock.mock.calls[0][1]?.body as string).toContain('data:audio/wav;base64,');
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
