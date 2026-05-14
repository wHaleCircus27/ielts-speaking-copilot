import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeTranscriptionResponse,
  normalizeNvidiaTranscriptionText,
  parseSseEvent,
  readErrorMessage,
  ProviderError,
  generateFeedbackDraft,
  streamFeedback,
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

  it('removes NVIDIA reasoning preambles before creating the transcript segment', () => {
    const segments = normalizeNvidiaTranscriptionText(
      `So, the correct answer is to output only the spoken transcript. Let's check the text:

The first part is the speaker saying "Part two now. Give you your question."`,
      20
    );

    expect(segments).toEqual([
      {
        id: 'segment-1',
        start: 0,
        end: 20,
        text: 'Part two now. Give you your question.'
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
        nvidia: 'nvapi-test',
        deepseek: ''
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
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual(expect.objectContaining({
      reasoning_budget: -1
    }));
  });

  it('uses NVIDIA reasoning_content as the transcript when content is null', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: null,
              reasoning_content: 'So part two now. Could you describe someone you like to spend time with?'
            }
          }
        ]
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
        nvidia: 'nvapi-test',
        deepseek: ''
      }
    };

    const segments = await transcribeAudio(file, settings, 12);

    expect(segments).toEqual([
      {
        id: 'segment-1',
        start: 0,
        end: 12,
        text: 'So part two now. Could you describe someone you like to spend time with?'
      }
    ]);
  });
});

describe('NVIDIA feedback', () => {
  it('streams with the recommended conservative generation limits', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { status: 200 })
    );
    const settings = {
      ...defaultSettings,
      llmProvider: 'nvidia' as const,
      llmModel: 'deepseek-ai/deepseek-v4-flash',
      apiKeys: {
        openai: '',
        groq: '',
        gemini: '',
        nvidia: 'nvapi-test',
        deepseek: ''
      }
    };

    const chunks = [];
    for await (const chunk of streamFeedback([{ id: 'segment-1', start: 0, end: 4, text: 'I like studying English.' }], settings)) {
      chunks.push(chunk);
    }

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(chunks).toEqual(['ok']);
    expect(body).toEqual(expect.objectContaining({
      model: 'deepseek-ai/deepseek-v4-flash',
      max_tokens: 16384,
      temperature: 0.3,
      stream: true
    }));
  });
});

describe('DeepSeek feedback', () => {
  it('streams through the DeepSeek chat completions endpoint with JSON object mode', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('data: {"choices":[{"delta":{"content":"ok","reasoning_content":"ignored"}}]}\n\ndata: [DONE]\n\n', { status: 200 })
    );
    const settings = {
      ...defaultSettings,
      llmProvider: 'deepseek' as const,
      llmModel: 'deepseek-v4-flash',
      apiKeys: {
        openai: '',
        groq: '',
        gemini: '',
        nvidia: '',
        deepseek: 'deepseek-test'
      }
    };

    const chunks = [];
    for await (const chunk of streamFeedback([{ id: 'segment-1', start: 0, end: 4, text: 'I like studying English.' }], settings)) {
      chunks.push(chunk);
    }

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer deepseek-test',
          'Content-Type': 'application/json'
        })
      })
    );
    expect(chunks).toEqual(['ok']);
    expect(body).toEqual(expect.objectContaining({
      model: 'deepseek-v4-flash',
      response_format: { type: 'json_object' },
      max_tokens: 384000,
      temperature: 0.3,
      stream: true
    }));
  });
});

describe('generateFeedbackDraft', () => {
  it('parses streamed scorecard JSON and requests 0.1 IELTS bands', async () => {
    const payload = JSON.stringify({
      scorecard: {
        overallBand: 6.7,
        fluencyCoherence: { band: 6.8, evidence: 'coherent answer', suggestion: 'vary linking' },
        lexicalResource: { band: 6.6, evidence: 'adequate words', suggestion: 'add precision' },
        grammaticalRangeAccuracy: { band: 6.4, evidence: 'some sentence errors', suggestion: 'control complex clauses' },
        pronunciation: { band: 6.9, evidence: 'clear speech', suggestion: 'improve stress' }
      },
      feedbackMarkdown: '## 总评\n\nGood.'
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(`data: {"choices":[{"delta":{"content":${JSON.stringify(payload)}}}]}\n\ndata: [DONE]\n\n`, { status: 200 })
    );
    const settings = {
      ...defaultSettings,
      llmProvider: 'openai' as const,
      llmModel: 'gpt-4o-mini',
      apiKeys: {
        openai: 'sk-test',
        groq: '',
        gemini: '',
        nvidia: '',
        deepseek: ''
      }
    };

    const result = await generateFeedbackDraft([{ id: 'segment-1', start: 0, end: 3, text: 'I enjoy reading.' }], settings);
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    const prompt = body.messages[1].content as string;

    expect(result.scorecard?.overallBand).toBe(6.7);
    expect(result.feedback).toContain('## 总评');
    expect(prompt).toContain('0.1');
    expect(prompt).toContain('overallBand');
    expect(prompt).toContain('fluencyCoherence');
  });

  it('preserves raw streamed output when scorecard JSON cannot be parsed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('data: {"choices":[{"delta":{"content":"## 总评\\n\\nOnly markdown"}}]}\n\ndata: [DONE]\n\n', { status: 200 })
    );
    const settings = {
      ...defaultSettings,
      llmProvider: 'openai' as const,
      llmModel: 'gpt-4o-mini',
      apiKeys: {
        openai: 'sk-test',
        groq: '',
        gemini: '',
        nvidia: '',
        deepseek: ''
      }
    };

    const result = await generateFeedbackDraft([{ id: 'segment-1', start: 0, end: 3, text: 'I enjoy reading.' }], settings);

    expect(result.scorecard).toBeNull();
    expect(result.parseError).toContain('评分表解析失败');
    expect(result.raw).toContain('Only markdown');
    expect(result.feedback).toContain('Only markdown');
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

    await testLlmProviderConnection('nvidia', 'nvapi-test', 'deepseek-ai/deepseek-v4-flash');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer nvapi-test',
          'Content-Type': 'application/json'
        }),
        body: expect.stringContaining('deepseek-ai/deepseek-v4-flash')
      })
    );
  });

  it('checks DeepSeek through the official chat completions endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

    await testLlmProviderConnection('deepseek', 'deepseek-test', 'deepseek-v4-flash');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer deepseek-test',
          'Content-Type': 'application/json'
        }),
        body: expect.stringContaining('deepseek-v4-flash')
      })
    );
  });
});
