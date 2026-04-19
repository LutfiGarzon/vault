import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanCommand } from '../../../src/features/clean/clean.js';
import * as run from '../../../src/core/run.js';
import * as envelope from '../../../src/core/envelope.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as p from '@clack/prompts';

vi.mock('@clack/prompts');
vi.mock('../../../src/core/run.js');
vi.mock('../../../src/core/envelope.js');

describe('Clean Feature', () => {
  const testDir = path.join(os.tmpdir(), 'vault-clean-test-' + Math.random().toString(36).substring(7));
  const envPath = path.join(testDir, '.env');
  const vaultPath = path.join(testDir, '.env.vault');

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

  it('should exit if .env does not exist', async () => {
    try {
      await cleanCommand();
    } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should not delete .env file if prompt is declined', async () => {
    fs.writeFileSync(envPath, 'SECRET=123');
    vi.mocked(p.confirm).mockResolvedValue(false);

    try {
      await cleanCommand();
    } catch {}

    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(fs.existsSync(envPath)).toBe(true);
  });

  it('should handle cancel prompt gracefully', async () => {
    fs.writeFileSync(envPath, 'SECRET=123');
    vi.mocked(p.confirm).mockResolvedValue(p.isCancel as any);
    vi.mocked(p.isCancel).mockReturnValue(true);

    try {
      await cleanCommand();
    } catch {}

    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(fs.existsSync(envPath)).toBe(true);
  });

  it('should exit if vault decryption fails', async () => {
    fs.writeFileSync(envPath, 'SECRET=123');
    fs.writeFileSync(vaultPath, '{}');
    vi.mocked(p.confirm).mockResolvedValue(true);
    vi.mocked(p.isCancel).mockReturnValue(false); // Make sure it's not canceled
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(envelope.decryptLocalVault).mockRejectedValue(new Error('fail'));

    try {
      await cleanCommand();
    } catch {}

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should smartly remove only vaulted keys, leaving unvaulted keys intact', async () => {
    const rawEnv = `
PORT=8080
# Secret below
SECRET_KEY=super_secret
PUBLIC_URL=https://google.com
`;
    fs.writeFileSync(envPath, rawEnv);
    fs.writeFileSync(vaultPath, '{}'); // dummy
    
    vi.mocked(p.confirm).mockResolvedValue(true);
    vi.mocked(p.isCancel).mockReturnValue(false); // Make sure it's not canceled
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(new Uint8Array(32));
    // Simulate that ONLY 'SECRET_KEY' is currently in the vault
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('SECRET_KEY=super_secret');

    await cleanCommand();

    // File should still exist because there are remaining non-secret variables
    expect(fs.existsSync(envPath)).toBe(true);
    const updatedEnv = fs.readFileSync(envPath, 'utf-8');
    
    expect(updatedEnv).toContain('PORT=8080');
    expect(updatedEnv).toContain('PUBLIC_URL=https://google.com');
    expect(updatedEnv).not.toContain('SECRET_KEY');
  });

  it('should completely delete .env if no unvaulted keys remain', async () => {
    const rawEnv = `
# Only secrets here
API_KEY=1234
TOKEN=abcd
`;
    fs.writeFileSync(envPath, rawEnv);
    fs.writeFileSync(vaultPath, '{}'); // dummy
    
    vi.mocked(p.confirm).mockResolvedValue(true);
    vi.mocked(p.isCancel).mockReturnValue(false); // Make sure it's not canceled
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('API_KEY=1234\nTOKEN=abcd');

    await cleanCommand();

    // File should be entirely unlinked because only comments/whitespace remain
    expect(fs.existsSync(envPath)).toBe(false);
  });

  it('should print dry-run summary and not modify .env', async () => {
    const rawEnv = `
PORT=8080
SECRET_KEY=super_secret
`;
    fs.writeFileSync(envPath, rawEnv);
    fs.writeFileSync(vaultPath, '{}');
    
    vi.mocked(p.confirm).mockResolvedValue(true);
    vi.mocked(p.isCancel).mockReturnValue(false); 
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('SECRET_KEY=super_secret');

    const unlinkSpy = vi.spyOn(fs, 'unlinkSync');
    const writeSpy = vi.spyOn(fs, 'writeFileSync');

    await cleanCommand({ dryRun: true });

    // In dry-run mode, these should NOT be called
    expect(unlinkSpy).not.toHaveBeenCalled();
    expect(writeSpy).not.toHaveBeenCalled();
    
    const unchangedEnv = fs.readFileSync(envPath, 'utf-8');
    expect(unchangedEnv).toContain('SECRET_KEY=super_secret');
  });
});
