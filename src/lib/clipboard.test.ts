import { describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from './clipboard';

describe('copyTextToClipboard', () => {
  it('copies the exact edited text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const text = 'Teacher edited final feedback\nwith exact spacing.';

    await copyTextToClipboard(text, { writeText });

    expect(writeText).toHaveBeenCalledWith(text);
  });
});
