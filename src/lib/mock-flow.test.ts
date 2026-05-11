import { describe, expect, it } from 'vitest';
import { defaultSettings } from './storage';
import { streamFeedback, transcribeAudio } from './providers';

describe('Mock provider flow', () => {
  it('transcribes and streams feedback without API keys or network', async () => {
    const file = new File(['demo'], 'answer.mp3', { type: 'audio/mpeg' });
    const settings = {
      ...defaultSettings,
      apiKeys: {
        openai: '',
        groq: '',
        gemini: '',
        nvidia: ''
      }
    };

    const segments = await transcribeAudio(file, settings, 60);
    expect(segments.length).toBeGreaterThan(0);

    let feedback = '';
    for await (const chunk of streamFeedback(segments, settings)) {
      feedback += chunk;
    }

    expect(feedback).toContain('## 总评');
    expect(feedback).toContain('## 可直接发送给学生的最终评语');
  });
});
