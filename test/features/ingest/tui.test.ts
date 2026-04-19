import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promptIngestOtp, confirmOverwrite } from '../../../src/features/ingest/tui.js';
import * as p from '@clack/prompts';

vi.mock('@clack/prompts');

describe('Ingest TUI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return otp', async () => {
    vi.mocked(p.password).mockResolvedValueOnce('123456');

    const result = await promptIngestOtp();
    expect(result).toBe('123456');
  });

  it('should return confirm result', async () => {
    vi.mocked(p.confirm).mockResolvedValueOnce(true);

    const result = await confirmOverwrite();
    expect(result).toBe(true);
  });

  it('should handle cancel for otp', async () => {
    vi.mocked(p.password).mockResolvedValueOnce(p.isCancel as any);
    vi.mocked(p.isCancel).mockReturnValue(true);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    try {
      await promptIngestOtp();
    } catch {}

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
  
  it('should handle cancel for confirm', async () => {
    vi.mocked(p.confirm).mockResolvedValueOnce(p.isCancel as any);
    vi.mocked(p.isCancel).mockReturnValue(true);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    try {
      await confirmOverwrite();
    } catch {}

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});