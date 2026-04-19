import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportCommand } from '../../../src/features/export/export.js';
import * as run from '../../../src/core/run.js';
import * as envelope from '../../../src/core/envelope.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('../../../src/core/run.js');
vi.mock('../../../src/core/envelope.js');

describe('Export Feature', () => {
  const testDir = path.join(os.tmpdir(), 'vault-export-test-' + Math.random().toString(36).substring(7));
  const vaultPath = path.join(testDir, '.env.vault');
  const envPath = path.join(testDir, '.env');

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

  it('should exit if local vault does not exist', async () => {
    try {
      await exportCommand();
    } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should decrypt vault and write to .env', async () => {
    fs.writeFileSync(vaultPath, JSON.stringify({ nonce: 'n', ciphertext: 'c', globalDek: { nonce: 'dn', ciphertext: 'dc' } }));
    
    const gmk = new Uint8Array(32);
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(gmk);
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('EXPORTED_KEY=123');

    await exportCommand();

    expect(envelope.decryptLocalVault).toHaveBeenCalled();
    expect(fs.existsSync(envPath)).toBe(true);
    expect(fs.readFileSync(envPath, 'utf-8')).toBe('EXPORTED_KEY=123');
  });

  it('should handle decryption failure', async () => {
    fs.writeFileSync(vaultPath, JSON.stringify({}));
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(envelope.decryptLocalVault).mockRejectedValue(new Error('fail'));

    try {
      await exportCommand();
    } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(fs.existsSync(envPath)).toBe(false);
  });

  it('should exit if gmk resolve fails', async () => {
    fs.writeFileSync(vaultPath, JSON.stringify({ nonce: 'n', ciphertext: 'c', globalDek: { nonce: 'dn', ciphertext: 'dc' } }));
    vi.mocked(run.resolveGlobalMasterKey).mockRejectedValue(new Error('fail'));

    try {
      await exportCommand();
    } catch {}

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(fs.existsSync(envPath)).toBe(false);
  });
});
