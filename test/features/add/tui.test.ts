import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promptForValue } from '../../../src/features/add/tui.js';
import * as p from '@clack/prompts';

vi.mock('@clack/prompts');

describe('Add TUI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return entered value', async () => {
    vi.mocked(p.password).mockResolvedValueOnce('new_value');

    const result = await promptForValue('NEW_KEY');
    expect(result).toBe('new_value');
  });

  it('should handle cancel when adding keys', async () => {
    vi.mocked(p.password).mockResolvedValueOnce(p.isCancel as any);
    vi.mocked(p.isCancel).mockReturnValue(true);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    try {
      await promptForValue('NEW_KEY');
    } catch {}

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});