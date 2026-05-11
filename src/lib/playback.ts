import type { TranscriptSegment } from './types';

export type SeekablePlayer = {
  currentTime: number;
  play: () => Promise<void> | void;
};

export function findActiveSegmentId(segments: TranscriptSegment[], currentTime: number): string | null {
  const active = segments.find((segment) => currentTime >= segment.start && currentTime < segment.end);
  return active?.id ?? null;
}

export function seekPlayerToSegment(player: SeekablePlayer, segment: TranscriptSegment): string {
  player.currentTime = segment.start;
  void Promise.resolve(player.play()).catch(() => undefined);
  return segment.id;
}
