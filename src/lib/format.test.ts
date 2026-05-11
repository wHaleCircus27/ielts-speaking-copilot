import { describe, expect, it } from 'vitest';
import { formatBytes, formatTime } from './format';

describe('formatTime', () => {
  it('formats seconds as mm:ss', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(12.8)).toBe('00:12');
    expect(formatTime(125)).toBe('02:05');
  });

  it('guards invalid values', () => {
    expect(formatTime(Number.NaN)).toBe('00:00');
    expect(formatTime(-1)).toBe('00:00');
  });
});

describe('formatBytes', () => {
  it('formats common byte sizes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
