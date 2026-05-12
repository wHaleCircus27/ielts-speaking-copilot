import type { Scorecard, ScorecardCriterion, ScorecardMetricKey } from './types';

type JsonRecord = Record<string, unknown>;

export const scorecardMetricLabels: Record<ScorecardMetricKey, string> = {
  fluencyCoherence: 'Fluency & Coherence',
  lexicalResource: 'Lexical Resource',
  grammaticalRangeAccuracy: 'Grammatical Range & Accuracy',
  pronunciation: 'Pronunciation'
};

const metricKeys = Object.keys(scorecardMetricLabels) as ScorecardMetricKey[];

export function emptyScorecard(): Scorecard {
  return {
    overallBand: null,
    fluencyCoherence: emptyCriterion(),
    lexicalResource: emptyCriterion(),
    grammaticalRangeAccuracy: emptyCriterion(),
    pronunciation: emptyCriterion()
  };
}

export function normalizeBand(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 9) {
    return null;
  }

  return Number(parsed.toFixed(1));
}

export function parseFeedbackPayload(raw: string): { scorecard: Scorecard | null; feedback: string; parseError: string | null } {
  const parsed = parseJsonBlock(raw);
  if (!parsed) {
    return { scorecard: null, feedback: raw, parseError: '评分表解析失败：模型未返回可解析的 JSON。' };
  }

  const scorecard = normalizeScorecard(parsed.scorecard);
  const feedback = typeof parsed.feedbackMarkdown === 'string' && parsed.feedbackMarkdown.trim()
    ? parsed.feedbackMarkdown.trim()
    : raw;

  if (!scorecard) {
    return { scorecard: null, feedback, parseError: '评分表解析失败：字段缺失或 band 超出 0-9 范围。' };
  }

  return { scorecard, feedback, parseError: null };
}

export function createScorecardMarkdown(scorecard: Scorecard): string {
  const lines = [`## IELTS 评分表`, '', `- Overall Band: ${formatBand(scorecard.overallBand)}`];

  for (const key of metricKeys) {
    const item = scorecard[key];
    lines.push(
      `- ${scorecardMetricLabels[key]}: ${formatBand(item.band)}`,
      `  - 依据：${item.evidence || '未提供'}`,
      `  - 建议：${item.suggestion || '未提供'}`
    );
  }

  return lines.join('\n');
}

export function formatBand(band: number | null): string {
  return band === null ? 'N/A' : band.toFixed(1);
}

function normalizeScorecard(value: unknown): Scorecard | null {
  if (!isRecord(value)) {
    return null;
  }

  const scorecard: Scorecard = {
    ...emptyScorecard(),
    overallBand: normalizeBand(value.overallBand)
  };

  for (const key of metricKeys) {
    const criterion = normalizeCriterion(value[key]);
    if (!criterion) {
      return null;
    }
    scorecard[key] = criterion;
  }

  return scorecard;
}

function normalizeCriterion(value: unknown): ScorecardCriterion | null {
  if (!isRecord(value)) {
    return null;
  }

  const evidence = typeof value.evidence === 'string' ? value.evidence.trim() : '';
  const suggestion = typeof value.suggestion === 'string' ? value.suggestion.trim() : '';
  const band = normalizeBand(value.band);

  if (band === null || !evidence || !suggestion) {
    return null;
  }

  return { band, evidence, suggestion };
}

function parseJsonBlock(raw: string): JsonRecord | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], trimmed, extractObject(trimmed)].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      return isRecord(parsed) ? parsed : null;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function extractObject(raw: string): string | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  return start >= 0 && end > start ? raw.slice(start, end + 1) : null;
}

function emptyCriterion(): ScorecardCriterion {
  return {
    band: null,
    evidence: '',
    suggestion: ''
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
