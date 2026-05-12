import type { AppSettings, FeedbackDraft, JobStatus, MediaJob, ReviewJobRecord, ReviewJobSummary, Scorecard, TranscriptSegment } from './types';

type ReviewPayload = {
  job: MediaJob;
  segments: TranscriptSegment[];
  feedback: FeedbackDraft;
  scorecard: Scorecard | null;
  settings: AppSettings;
};

async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, args);
  } catch {
    return null;
  }
}

export function buildReviewRecord(payload: ReviewPayload, now = new Date()): ReviewJobRecord {
  const createdAt = payload.job.createdAt ?? now.toISOString();
  const updatedAt = now.toISOString();
  const feedbackContent = payload.feedback.content.trim();
  const transcriptText = payload.segments.map((segment) => segment.text).join(' ').trim();

  return {
    id: payload.job.id,
    fileName: payload.job.fileName,
    fileType: payload.job.fileType,
    fileSize: payload.job.fileSize,
    duration: payload.job.duration,
    status: payload.job.status,
    createdAt,
    updatedAt,
    providerSnapshot: {
      asrProvider: payload.settings.asrProvider,
      asrModel: payload.settings.asrModel,
      llmProvider: payload.settings.llmProvider,
      llmModel: payload.settings.llmModel
    },
    transcriptPreview: transcriptText.slice(0, 180),
    feedbackPreview: feedbackContent.slice(0, 180),
    segments: payload.segments,
    feedback: payload.feedback,
    scorecard: payload.scorecard
  };
}

export function searchReviews(reviews: ReviewJobSummary[], query: string): ReviewJobSummary[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return reviews;
  }

  return reviews.filter((review) =>
    [
      review.fileName,
      review.fileType,
      review.status,
      review.createdAt,
      review.updatedAt,
      review.transcriptPreview,
      review.feedbackPreview
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalized)
  );
}

export async function listReviews(): Promise<ReviewJobSummary[]> {
  return (await invokeTauri<ReviewJobSummary[]>('list_reviews')) ?? loadBrowserReviews().map(toSummary);
}

export async function loadReview(id: string): Promise<ReviewJobRecord | null> {
  return (await invokeTauri<ReviewJobRecord>('load_review', { id })) ?? loadBrowserReviews().find((review) => review.id === id) ?? null;
}

export async function saveReview(record: ReviewJobRecord): Promise<void> {
  const saved = await invokeTauri('save_review', { review: record });
  if (saved !== null) {
    return;
  }

  const reviews = loadBrowserReviews().filter((review) => review.id !== record.id);
  reviews.push(record);
  window.localStorage.setItem(browserHistoryKey, JSON.stringify(reviews));
}

export async function deleteReview(id: string): Promise<void> {
  const deleted = await invokeTauri('delete_review', { id });
  if (deleted !== null) {
    return;
  }

  const reviews = loadBrowserReviews().filter((review) => review.id !== id);
  window.localStorage.setItem(browserHistoryKey, JSON.stringify(reviews));
}

export function toMediaJob(record: ReviewJobRecord): MediaJob {
  return {
    id: record.id,
    fileName: record.fileName,
    fileType: record.fileType,
    fileSize: record.fileSize,
    duration: record.duration,
    status: record.status as JobStatus,
    errorMessage: null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    providerSnapshot: record.providerSnapshot
  };
}

const browserHistoryKey = 'ielts-speaking-copilot.reviews.v0.2';

function loadBrowserReviews(): ReviewJobRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(browserHistoryKey);
    return raw ? JSON.parse(raw) as ReviewJobRecord[] : [];
  } catch {
    return [];
  }
}

function toSummary(review: ReviewJobRecord): ReviewJobSummary {
  const { segments: _segments, feedback: _feedback, scorecard: _scorecard, ...summary } = review;
  return summary;
}
