import { describe, expect, it } from 'vitest';
import { formatBand, normalizeBand, parseFeedbackPayload } from './scorecard';

const validPayload = {
  scorecard: {
    overallBand: 6.7,
    fluencyCoherence: { band: 6.8, evidence: 'clear order', suggestion: 'use richer linking' },
    lexicalResource: { band: 6.6, evidence: 'natural vocabulary', suggestion: 'add precise topic words' },
    grammaticalRangeAccuracy: { band: 6.4, evidence: 'basic clauses are accurate', suggestion: 'control longer sentences' },
    pronunciation: { band: 6.9, evidence: 'mostly intelligible', suggestion: 'improve sentence stress' }
  },
  feedbackMarkdown: '## 总评\n\nGood.'
};

describe('normalizeBand', () => {
  it('keeps IELTS bands at 0.1 precision', () => {
    expect(normalizeBand(6.74)).toBe(6.7);
    expect(formatBand(6.7)).toBe('6.7');
  });

  it('rejects bands outside 0-9', () => {
    expect(normalizeBand(9.1)).toBeNull();
    expect(normalizeBand(-0.1)).toBeNull();
  });
});

describe('parseFeedbackPayload', () => {
  it('parses scorecard JSON and feedback markdown', () => {
    const result = parseFeedbackPayload(JSON.stringify(validPayload));

    expect(result.parseError).toBeNull();
    expect(result.scorecard?.overallBand).toBe(6.7);
    expect(result.scorecard?.fluencyCoherence.band).toBe(6.8);
    expect(result.feedback).toContain('## 总评');
  });

  it('parses fenced or mixed JSON responses', () => {
    const result = parseFeedbackPayload(`Result:\n\`\`\`json\n${JSON.stringify(validPayload)}\n\`\`\``);

    expect(result.parseError).toBeNull();
    expect(result.scorecard?.pronunciation.band).toBe(6.9);
  });

  it('keeps raw feedback when the response is not parseable', () => {
    const result = parseFeedbackPayload('## 总评\n\nOnly markdown');

    expect(result.scorecard).toBeNull();
    expect(result.parseError).toContain('评分表解析失败');
    expect(result.feedback).toContain('Only markdown');
  });

  it('rejects missing fields and invalid band values', () => {
    const result = parseFeedbackPayload(JSON.stringify({
      ...validPayload,
      scorecard: {
        ...validPayload.scorecard,
        lexicalResource: { band: 10, evidence: 'x', suggestion: 'y' }
      }
    }));

    expect(result.scorecard).toBeNull();
    expect(result.parseError).toContain('评分表解析失败');
  });
});
