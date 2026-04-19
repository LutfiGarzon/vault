import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promptForOtp } from '../../../src/features/share/tui.js';
import * as p from '@clack/prompts';

vi.mock('@clack/prompts');

describe('Share TUI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return token duration', async () => {
    vi.mocked(p.password).mockResolvedValueOnce('123456');
    vi.mocked(p.password).mockResolvedValueOnce('123456');

    const result = await promptForOtp();
    expect(result).toBe('123456');
  });

  it('should handle cancel', async () => {
    vi.mocked(p.password).mockResolvedValueOnce(p.isCancel as any);
    vi.mocked(p.isCancel).mockReturnValue(true);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    try {
      await promptForOtp();
    } catch {}

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});