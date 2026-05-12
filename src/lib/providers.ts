import { buildFeedback, createDraftTranscript } from './mock-ai';
import type { AppSettings, AsrProvider, LlmProvider, TranscriptSegment } from './types';

type JsonRecord = Record<string, unknown>;

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderError';
  }
}

export function needsAsrKey(settings: AppSettings): boolean {
  return settings.asrProvider !== 'mock';
}

export function needsLlmKey(settings: AppSettings): boolean {
  return settings.llmProvider !== 'mock';
}

export function getProviderLabel(provider: AsrProvider | LlmProvider): string {
  const labels: Record<AsrProvider | LlmProvider, string> = {
    mock: 'Mock',
    openai: 'OpenAI',
    groq: 'Groq',
    gemini: 'Gemini',
    nvidia: 'NVIDIA'
  };

  return labels[provider];
}

export function getProviderApiKey(settings: AppSettings, provider: AsrProvider | LlmProvider): string {
  if (provider === 'mock') {
    return '';
  }

  return settings.apiKeys[provider].trim();
}

export async function transcribeAudio(
  file: File,
  settings: AppSettings,
  duration: number | null
): Promise<TranscriptSegment[]> {
  if (settings.asrProvider === 'mock') {
    await delay(500);
    return createDraftTranscript(duration);
  }

  assertModel(settings.asrModel, 'ASR');
  assertApiKey(settings, settings.asrProvider);
  assertFileSize(file, settings);

  if (settings.asrProvider === 'openai') {
    return transcribeWithOpenAi(file, settings);
  }

  if (settings.asrProvider === 'groq') {
    return transcribeWithGroq(file, settings);
  }

  return transcribeWithNvidia(file, settings, duration);
}

export async function* streamFeedback(
  segments: TranscriptSegment[],
  settings: AppSettings
): AsyncGenerator<string> {
  if (segments.length === 0) {
    throw new ProviderError('请先完成转录，再生成批注。');
  }

  if (settings.llmProvider === 'mock') {
    yield* streamMockFeedback(segments);
    return;
  }

  assertModel(settings.llmModel, 'LLM');
  assertApiKey(settings, settings.llmProvider);

  if (settings.llmProvider === 'openai') {
    yield* streamOpenAiFeedback(segments, settings);
    return;
  }

  if (settings.llmProvider === 'groq') {
    yield* streamGroqFeedback(segments, settings);
    return;
  }

  if (settings.llmProvider === 'nvidia') {
    yield* streamNvidiaFeedback(segments, settings);
    return;
  }

  yield* streamGeminiFeedback(segments, settings);
}

export async function testLlmProviderConnection(
  provider: Exclude<LlmProvider, 'mock'>,
  apiKey: string,
  model: string
): Promise<void> {
  const key = apiKey.trim();
  if (!key) {
    throw new ProviderError(`请先填写 ${getProviderLabel(provider)} API Key。`);
  }

  assertModel(model, 'LLM');

  if (provider === 'gemini') {
    const encodedModel = encodeURIComponent(model.trim());
    const response = await safeFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with ok only.' }] }],
          generationConfig: { maxOutputTokens: 4, temperature: 0 }
        })
      }
    );
    if (!response.ok) {
      throw new ProviderError(await readErrorMessage(response));
    }
    await response.text();
    return;
  }

  const endpoint =
    provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : provider === 'nvidia'
        ? 'https://integrate.api.nvidia.com/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
  const response = await safeFetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model.trim(),
      messages: [{ role: 'user', content: 'Reply with ok only.' }],
      max_tokens: 4,
      temperature: 0,
      stream: false
    })
  });

  if (!response.ok) {
    throw new ProviderError(await readErrorMessage(response));
  }
  await response.text();
}

async function transcribeWithOpenAi(file: File, settings: AppSettings): Promise<TranscriptSegment[]> {
  const response = await postTranscription('https://api.openai.com/v1/audio/transcriptions', file, {
    apiKey: settings.apiKeys.openai,
    model: settings.asrModel
  });

  return normalizeTranscriptionResponse(response);
}

async function transcribeWithGroq(file: File, settings: AppSettings): Promise<TranscriptSegment[]> {
  const response = await postTranscription('https://api.groq.com/openai/v1/audio/transcriptions', file, {
    apiKey: settings.apiKeys.groq,
    model: settings.asrModel
  });

  return normalizeTranscriptionResponse(response);
}

async function transcribeWithNvidia(
  file: File,
  settings: AppSettings,
  duration: number | null
): Promise<TranscriptSegment[]> {
  const audioData = await fileToBase64(file);
  const mimeType = file.type || 'audio/wav';
  const response = await safeFetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKeys.nvidia.trim()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: settings.asrModel,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Transcribe this IELTS speaking homework audio. Return only the spoken transcript text. Do not add commentary, markdown, timestamps, or labels.'
            },
            {
              type: 'audio_url',
              audio_url: {
                url: `data:${mimeType};base64,${audioData}`
              }
            }
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0,
      stream: false
    })
  });

  const data = (await readJsonResponse(response)) as JsonRecord;
  const text = extractChatCompletionText(data);
  return normalizeNvidiaTranscriptionText(text, duration);
}

async function postTranscription(
  endpoint: string,
  file: File,
  options: { apiKey: string; model: string }
): Promise<unknown> {
  const form = new FormData();
  form.append('file', file);
  form.append('model', options.model);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');

  const response = await safeFetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey.trim()}`
    },
    body: form
  });

  return readJsonResponse(response);
}

async function* streamOpenAiFeedback(
  segments: TranscriptSegment[],
  settings: AppSettings
): AsyncGenerator<string> {
  yield* streamChatCompletions('https://api.openai.com/v1/chat/completions', settings.apiKeys.openai, {
    model: settings.llmModel,
    messages: buildFeedbackMessages(segments),
    temperature: 0.4,
    stream: true
  });
}

async function* streamGroqFeedback(
  segments: TranscriptSegment[],
  settings: AppSettings
): AsyncGenerator<string> {
  yield* streamChatCompletions('https://api.groq.com/openai/v1/chat/completions', settings.apiKeys.groq, {
    model: settings.llmModel,
    messages: buildFeedbackMessages(segments),
    temperature: 0.4,
    stream: true
  });
}

async function* streamNvidiaFeedback(
  segments: TranscriptSegment[],
  settings: AppSettings
): AsyncGenerator<string> {
  yield* streamChatCompletions('https://integrate.api.nvidia.com/v1/chat/completions', settings.apiKeys.nvidia, {
    model: settings.llmModel,
    messages: buildFeedbackMessages(segments),
    temperature: 0.4,
    stream: true
  });
}

async function* streamGeminiFeedback(
  segments: TranscriptSegment[],
  settings: AppSettings
): AsyncGenerator<string> {
  const model = encodeURIComponent(settings.llmModel);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(
    settings.apiKeys.gemini.trim()
  )}`;

  const response = await safeFetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: buildFeedbackPrompt(segments) }]
        }
      ],
      generationConfig: {
        temperature: 0.4
      }
    })
  });

  yield* streamSseResponse(response, (event) => {
    const candidate = asArray(event.candidates)[0] as JsonRecord | undefined;
    const content = candidate?.content as JsonRecord | undefined;
    return asArray(content?.parts)
      .map((part) => (part as JsonRecord).text)
      .filter((text): text is string => typeof text === 'string')
      .join('');
  });
}

async function* streamChatCompletions(
  endpoint: string,
  apiKey: string,
  body: JsonRecord
): AsyncGenerator<string> {
  const response = await safeFetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  yield* streamSseResponse(response, (event) => {
    const choice = asArray(event.choices)[0] as JsonRecord | undefined;
    const delta = choice?.delta as JsonRecord | undefined;
    return typeof delta?.content === 'string' ? delta.content : '';
  });
}

async function* streamSseResponse(
  response: Response,
  pickText: (event: JsonRecord) => string
): AsyncGenerator<string> {
  if (!response.ok) {
    throw new ProviderError(await readErrorMessage(response));
  }

  if (!response.body) {
    throw new ProviderError('Provider 没有返回可读取的流。');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? '';

    for (const event of events) {
      for (const chunk of parseSseEvent(event, pickText)) {
        yield chunk;
      }
    }
  }

  if (buffer.trim()) {
    for (const chunk of parseSseEvent(buffer, pickText)) {
      yield chunk;
    }
  }
}

export function parseSseEvent(event: string, pickText: (event: JsonRecord) => string): string[] {
  const chunks: string[] = [];
  const dataLines = event
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());

  for (const data of dataLines) {
    if (!data || data === '[DONE]') {
      continue;
    }

    try {
      const parsed = JSON.parse(data) as JsonRecord;
      const text = pickText(parsed);
      if (text) {
        chunks.push(text);
      }
    } catch {
      throw new ProviderError('Provider 返回了无法解析的流式数据。');
    }
  }

  return chunks;
}

export function normalizeTranscriptionResponse(response: unknown): TranscriptSegment[] {
  const data = response as JsonRecord;
  const rawSegments = asArray(data.segments);

  if (rawSegments.length > 0) {
    const segments = rawSegments
      .map((segment, index) => normalizeSegment(segment as JsonRecord, index))
      .filter((segment): segment is TranscriptSegment => Boolean(segment));

    if (segments.length > 0) {
      return segments;
    }
  }

  if (typeof data.text === 'string' && data.text.trim()) {
    return [
      {
        id: 'segment-1',
        start: 0,
        end: 0,
        text: data.text.trim()
      }
    ];
  }

  throw new ProviderError('ASR 返回为空，未能生成可用转录。');
}

export function normalizeNvidiaTranscriptionText(text: string, duration: number | null): TranscriptSegment[] {
  const cleaned = text
    .replace(/^transcript\s*:\s*/i, '')
    .replace(/^spoken transcript\s*:\s*/i, '')
    .trim();

  if (!cleaned) {
    throw new ProviderError('NVIDIA ASR 返回为空，未能生成可用转录。');
  }

  return [
    {
      id: 'segment-1',
      start: 0,
      end: duration && Number.isFinite(duration) ? duration : 0,
      text: cleaned
    }
  ];
}

function extractChatCompletionText(data: JsonRecord): string {
  const choice = asArray(data.choices)[0] as JsonRecord | undefined;
  const message = choice?.message as JsonRecord | undefined;
  const content = message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => ((part as JsonRecord).text))
      .filter((text): text is string => typeof text === 'string')
      .join('');
  }

  return '';
}

function normalizeSegment(segment: JsonRecord, index: number): TranscriptSegment | null {
  const text = typeof segment.text === 'string' ? segment.text.trim() : '';
  if (!text) {
    return null;
  }

  return {
    id: String(segment.id ?? `segment-${index + 1}`),
    start: toNumber(segment.start),
    end: toNumber(segment.end),
    text
  };
}

function buildFeedbackMessages(segments: TranscriptSegment[]) {
  return [
    {
      role: 'system',
      content:
        'You are an IELTS speaking teacher. Write concise, actionable feedback in Simplified Chinese. Use Markdown headings exactly as requested.'
    },
    {
      role: 'user',
      content: buildFeedbackPrompt(segments)
    }
  ];
}

function buildFeedbackPrompt(segments: TranscriptSegment[]): string {
  const transcript = segments
    .map((segment) => `[${segment.start.toFixed(1)}-${segment.end.toFixed(1)}] ${segment.text}`)
    .join('\n');

  return `请根据以下雅思口语转录生成批改反馈。\n\n要求使用以下 Markdown 结构：\n\n## 总评\n## 优点\n## 主要问题\n## 原句与修改建议\n## 提升建议\n## 可直接发送给学生的最终评语\n\n转录：\n${transcript}`;
}

async function* streamMockFeedback(segments: TranscriptSegment[]): AsyncGenerator<string> {
  const content = buildFeedback(segments);

  for (let index = 0; index < content.length; index += 18) {
    await delay(25);
    yield content.slice(index, index + 18);
  }
}

function assertModel(model: string, label: string): void {
  if (!model.trim()) {
    throw new ProviderError(`请先填写 ${label} 模型。`);
  }
}

function assertApiKey(settings: AppSettings, provider: Exclude<AsrProvider | LlmProvider, 'mock'>): void {
  if (!settings.apiKeys[provider].trim()) {
    throw new ProviderError(`请先填写 ${getProviderLabel(provider)} API Key。`);
  }
}

function assertFileSize(file: File, settings: AppSettings): void {
  const maxBytes = settings.limits.maxFileSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new ProviderError(`当前文件超过 ${settings.limits.maxFileSizeMb} MB。请调整限制或选择更短音频。`);
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new ProviderError(await readErrorMessage(response));
  }

  try {
    return await response.json();
  } catch {
    throw new ProviderError('Provider 返回了无法解析的 JSON。');
  }
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

async function fetchWithTauri(input: RequestInfo | URL, init: RequestInit): Promise<Response | null> {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    return null;
  }

  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    return await tauriFetch(input, init);
  } catch {
    return null;
  }
}

async function safeFetch(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  try {
    return (await fetchWithTauri(input, init)) ?? (await fetch(input, init));
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知网络错误';
    throw new ProviderError(`网络请求失败：${message}。真实 provider 请求会优先通过 Tauri HTTP 插件发送；请确认正在使用桌面壳并检查网络连接。`);
  }
}

export async function readErrorMessage(response: Response): Promise<string> {
  let details = '';

  try {
    const data = (await response.json()) as JsonRecord;
    const error = data.error as JsonRecord | undefined;
    details = typeof error?.message === 'string' ? error.message : JSON.stringify(data);
  } catch {
    details = await response.text().catch(() => '');
  }

  const suffix = details ? `：${details}` : '';
  return `Provider 请求失败 (${response.status})${suffix}`;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
