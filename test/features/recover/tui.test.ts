import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promptForRecoveryKey, promptForNewPassword } from '../../../src/features/recover/tui.js';
import * as p from '@clack/prompts';

vi.mock('@clack/prompts');

describe('Recover TUI', () => {
  let exitSpy: any;

  beforeEach(() => {
    vi.resetAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: number) => { throw new Error(`exit ${code}`); }) as any);
  });

  it('should validate recovery key', async () => {
    vi.mocked(p.text).mockImplementationOnce((options: any) => {
      expect(options.validate('')).toBeDefined();
      expect(options.validate('invalid')).toBeDefined();
      expect(options.validate('vlt-rcv-1234')).toBeUndefined();
      return Promise.resolve('vlt-rcv-1234');
    });
    await promptForRecoveryKey();
  });

  it('should validate new password', async () => {
    vi.mocked(p.password).mockImplementationOnce((options: any) => {
      expect(options.validate('')).toBeDefined();
      expect(options.validate('short')).toBeDefined();
      expect(options.validate('longenough')).toBeUndefined();
      return Promise.resolve('longenough');
    });
    await promptForNewPassword();
  });

  it('should return recovery key', async () => {
    vi.mocked(p.text).mockResolvedValueOnce('vlt-rcv-1234');
    const result = await promptForRecoveryKey();
    expect(result).toBe('vlt-rcv-1234');
  });

  it('should exit on cancel recovery key', async () => {
    vi.mocked(p.text).mockResolvedValueOnce(p.isCancel as any);
    vi.mocked(p.isCancel).mockReturnValue(true);
    await expect(promptForRecoveryKey()).rejects.toThrow('exit 1');
  });

  it('should return new password', async () => {
    vi.mocked(p.password).mockResolvedValueOnce('new-password');
    const result = await promptForNewPassword();
    expect(result).toBe('new-password');
  });

  it('should exit on cancel password', async () => {
    vi.mocked(p.password).mockResolvedValueOnce(p.isCancel as any);
    vi.mocked(p.isCancel).mockReturnValue(true);
    await expect(promptForNewPassword()).rejects.toThrow('exit 1');
  });
});
