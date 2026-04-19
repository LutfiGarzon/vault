import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanCommand } from '../../../src/features/clean/clean.js';
import * as run from '../../../src/core/run.js';
import * as envelope from '../../../src/core/envelope.js';
import * as identity from '../../../src/core/identity.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as p from '@clack/prompts';

vi.mock('@clack/prompts');
vi.mock('../../../src/core/run.js');
vi.mock('../../../src/core/envelope.js');
vi.mock('../../../src/core/identity.js');

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

  it('should exit if vault decryption fails', async () => {
    fs.writeFileSync(envPath, 'SECRET=123');
    fs.writeFileSync(vaultPath, '{}');
    vi.mocked(p.confirm).mockResolvedValue(true);
    vi.mocked(p.isCancel).mockReturnValue(false);
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(envelope.decryptLocalVault).mockRejectedValue(new Error('fail'));

    try {
      await cleanCommand();
    } catch {}

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should smartly remove only vaulted keys, leaving unvaulted keys intact', async () => {
    const rawEnv = 'PORT=8080\nSECRET_KEY=super_secret';
    fs.writeFileSync(envPath, rawEnv);
    fs.writeFileSync(vaultPath, '{}');
    
    vi.mocked(p.confirm).mockResolvedValue(true);
    vi.mocked(p.isCancel).mockReturnValue(false);
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('SECRET_KEY=super_secret');

    await cleanCommand();

    const updated = fs.readFileSync(envPath, 'utf-8');
    expect(updated).toContain('PORT=8080');
    expect(updated).not.toContain('SECRET_KEY');
  });

  it('should clean a shell file with global vault and NOT delete the file', async () => {
    const zshPath = path.join(testDir, '.zshrc');
    const rawZsh = 'export SECRET=1\nexport PUBLIC=2';
    fs.writeFileSync(zshPath, rawZsh);
    const globalVaultPath = path.join(testDir, 'global.vault');
    fs.writeFileSync(globalVaultPath, '{}');
    
    vi.mocked(p.confirm).mockResolvedValue(true);
    vi.mocked(p.isCancel).mockReturnValue(false); 
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(identity.getGlobalVaultPath).mockReturnValue(globalVaultPath);
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('SECRET=1');

    await cleanCommand({ global: true, file: '.zshrc' });

    expect(fs.existsSync(zshPath)).toBe(true);
    const content = fs.readFileSync(zshPath, 'utf-8');
    expect(content).toContain('export PUBLIC=2');
    expect(content).not.toContain('SECRET=1');
  });

  it('should print dry-run summary and not modify .env', async () => {
    const rawEnv = 'PORT=8080\nSECRET_KEY=super_secret';
    fs.writeFileSync(envPath, rawEnv);
    fs.writeFileSync(vaultPath, '{}');
    
    vi.mocked(p.confirm).mockResolvedValue(true);
    vi.mocked(p.isCancel).mockReturnValue(false); 
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('SECRET_KEY=super_secret');

    await cleanCommand({ dryRun: true });

    const unchangedEnv = fs.readFileSync(envPath, 'utf-8');
    expect(unchangedEnv).toContain('SECRET_KEY=super_secret');
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
});
