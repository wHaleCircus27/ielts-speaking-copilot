export type JobStatus =
  | 'idle'
  | 'loaded'
  | 'transcribing'
  | 'transcribed'
  | 'generating'
  | 'ready'
  | 'failed';

export type TranscriptSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
};

export type AsrProvider = 'mock' | 'openai' | 'groq' | 'nvidia';

export type LlmProvider = 'mock' | 'openai' | 'groq' | 'gemini' | 'nvidia';

export type AppSettings = {
  asrProvider: AsrProvider;
  asrModel: string;
  llmProvider: LlmProvider;
  llmModel: string;
  appearance: {
    fontFamily: string;
    fontSize: 'small' | 'medium' | 'large';
    themeColor: string;
    language: 'zh' | 'en';
  };
  apiKeys: {
    openai: string;
    groq: string;
    gemini: string;
    nvidia: string;
  };
  limits: {
    maxFileSizeMb: number;
    maxDurationMinutes: number;
  };
};

export type MediaJob = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  duration: number | null;
  status: JobStatus;
  errorMessage: string | null;
};

export type FeedbackDraft = {
  content: string;
  source: 'ai' | 'edited';
};
