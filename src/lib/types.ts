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
  source?: 'asr' | 'edited';
};

export type AsrProvider = 'mock' | 'openai' | 'groq' | 'nvidia';

export type LlmProvider = 'mock' | 'openai' | 'groq' | 'gemini' | 'nvidia' | 'deepseek';

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
    deepseek: string;
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
  createdAt?: string;
  updatedAt?: string;
  providerSnapshot?: ProviderSnapshot;
};

export type FeedbackDraft = {
  content: string;
  aiContent?: string;
  source: 'ai' | 'edited';
};

export type ProviderSnapshot = {
  asrProvider: AsrProvider;
  asrModel: string;
  llmProvider: LlmProvider;
  llmModel: string;
};

export type ScorecardMetricKey =
  | 'fluencyCoherence'
  | 'lexicalResource'
  | 'grammaticalRangeAccuracy'
  | 'pronunciation';

export type ScorecardCriterion = {
  band: number | null;
  evidence: string;
  suggestion: string;
};

export type Scorecard = Record<ScorecardMetricKey, ScorecardCriterion> & {
  overallBand: number | null;
};

export type ReviewJobSummary = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  duration: number | null;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  providerSnapshot: ProviderSnapshot;
  transcriptPreview: string;
  feedbackPreview: string;
};

export type ReviewJobRecord = ReviewJobSummary & {
  segments: TranscriptSegment[];
  feedback: FeedbackDraft;
  scorecard: Scorecard | null;
};
