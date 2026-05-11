import { describe, expect, it, vi } from 'vitest';
import { findActiveSegmentId, seekPlayerToSegment } from './playback';
import type { TranscriptSegment } from './types';

const segments: TranscriptSegment[] = [
  { id: 'a', start: 0, end: 10, text: 'First' },
  { id: 'b', start: 10, end: 20, text: 'Second' }
];

describe('findActiveSegmentId', () => {
  it('finds the active segment for the current playback time', () => {
    expect(findActiveSegmentId(segments, 0)).toBe('a');
    expect(findActiveSegmentId(segments, 10)).toBe('b');
    expect(findActiveSegmentId(segments, 20)).toBeNull();
  });
});

describe('seekPlayerToSegment', () => {
  it('sets currentTime to segment.start and starts playback', () => {
    const play = vi.fn();
    const player = { currentTime: 4, play };

    expect(seekPlayerToSegment(player, segments[1])).toBe('b');
    expect(player.currentTime).toBe(10);
    expect(Math.abs(player.currentTime - segments[1].start)).toBeLessThanOrEqual(0.3);
    expect(play).toHaveBeenCalledTimes(1);
  });
});
