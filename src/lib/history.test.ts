import { describe, expect, it } from 'vitest';
import { buildReviewRecord, searchReviews } from './history';
import { defaultSettings } from './storage';

describe('buildReviewRecord', () => {
  it('stores review text and metadata without API keys or media content', () => {
    const record = buildReviewRecord({
      job: {
        id: 'review-1',
        fileName: 'student-answer.mp3',
        fileType: 'audio/mpeg',
        fileSize: 1234,
        duration: 62,
        status: 'ready',
        errorMessage: null
      },
      segments: [{ id: 's1', start: 0, end: 5, text: 'Edited transcript', source: 'edited' }],
      feedback: { content: 'Final feedback', source: 'edited' },
      scorecard: null,
      settings: {
        ...defaultSettings,
        apiKeys: {
          openai: 'secret-openai',
          groq: '',
          gemini: '',
          nvidia: '',
          deepseek: ''
        }
      }
    }, new Date('2026-05-13T00:00:00.000Z'));

    expect(record.fileName).toBe('student-answer.mp3');
    expect(record.providerSnapshot.asrProvider).toBe(defaultSettings.asrProvider);
    expect(JSON.stringify(record)).not.toContain('secret-openai');
    expect(JSON.stringify(record)).not.toContain('data:audio');
  });
});

describe('searchReviews', () => {
  const reviews = [
    {
      id: 'one',
      fileName: 'amy.mp3',
      fileType: 'audio/mpeg',
      fileSize: 10,
      duration: 20,
      status: 'ready' as const,
      createdAt: '2026-05-13T00:00:00.000Z',
      updatedAt: '2026-05-13T00:00:00.000Z',
      providerSnapshot: {
        asrProvider: 'mock' as const,
        asrModel: 'mock-transcriber',
        llmProvider: 'mock' as const,
        llmModel: 'mock-feedback'
      },
      transcriptPreview: 'I like museums',
      feedbackPreview: 'Good fluency'
    }
  ];

  it('matches file names and text previews', () => {
    expect(searchReviews(reviews, 'amy')).toHaveLength(1);
    expect(searchReviews(reviews, 'museums')).toHaveLength(1);
    expect(searchReviews(reviews, 'missing')).toHaveLength(0);
  });
});
