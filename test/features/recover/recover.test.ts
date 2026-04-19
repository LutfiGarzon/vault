import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { recoverCommand } from '../../../src/features/recover/recover.js';
import * as run from '../../../src/core/run.js';
import * as tui from '../../../src/features/recover/tui.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('../../../src/core/run.js');
vi.mock('../../../src/features/recover/tui.js');

describe('Recover Feature', () => {
  const testDir = path.join(os.tmpdir(), 'vault-recover-test-' + Math.random().toString(36).substring(7));

  let exitSpy: any;
  let cwdSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(testDir);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: number) => { throw new Error(`exit ${code}`) }) as any);
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('should recover global identity using a recovery key', async () => {
    vi.mocked(tui.promptForRecoveryKey).mockResolvedValue('test-recovery-key');
    vi.mocked(tui.promptForNewPassword).mockResolvedValue('new-password');

    await recoverCommand();

    expect(tui.promptForRecoveryKey).toHaveBeenCalled();
    expect(tui.promptForNewPassword).toHaveBeenCalled();
    expect(run.recoverGlobalIdentity).toHaveBeenCalledWith('test-recovery-key', 'new-password');
  });

  it('should handle failure during recovery', async () => {
    vi.mocked(tui.promptForRecoveryKey).mockResolvedValue('test-recovery-key');
    vi.mocked(tui.promptForNewPassword).mockResolvedValue('new-password');
    vi.mocked(run.recoverGlobalIdentity).mockRejectedValue(new Error('fail'));

    await expect(recoverCommand()).rejects.toThrow('exit 1');
  });
});
