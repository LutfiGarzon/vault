import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { shareCommand } from '../../../src/features/share/share.js';
import * as run from '../../../src/core/run.js';
import * as envelope from '../../../src/core/envelope.js';
import * as crypto from '../../../src/core/crypto.js';
import * as tui from '../../../src/features/share/tui.js';
import _sodium from 'libsodium-wrappers';

vi.mock('../../../src/core/run.js');
vi.mock('../../../src/core/envelope.js');
vi.mock('../../../src/core/crypto.js');
vi.mock('../../../src/features/share/tui.js');
vi.mock('@clack/prompts');

describe('Share Feature', () => {
  const testDir = path.join(os.tmpdir(), 'vault-share-test-' + Math.random().toString(36).substring(7));
  const vaultPath = path.join(testDir, '.env.vault');
  const sharedPath = path.join(testDir, 'shared.vault');

  let exitSpy: any;
  let cwdSpy: any;

  beforeEach(async () => {
    await _sodium.ready;
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(testDir);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: number) => { throw new Error(`exit ${code}`) }) as any);
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('should exit if vault does not exist', async () => {
    try {
      await shareCommand();
    } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should create a shared vault from local vault', async () => {
    const gmk = new Uint8Array(32);
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(gmk);
    
    const localPayload = { nonce: 'n', ciphertext: 'c', globalDek: { nonce: 'dn', ciphertext: 'dc' } };
    fs.writeFileSync(vaultPath, JSON.stringify(localPayload));
    
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('SECRET=shared');
    vi.mocked(tui.promptForOtp).mockResolvedValue('test-otp');
    vi.mocked(crypto.encryptPayload).mockResolvedValue({
        salt: 's',
        nonce: 'sn',
        ciphertext: 'sc'
    });

    await shareCommand();

    expect(envelope.decryptLocalVault).toHaveBeenCalledWith(localPayload, gmk);
    expect(crypto.encryptPayload).toHaveBeenCalledWith('SECRET=shared', 'test-otp');
    
    expect(fs.existsSync(sharedPath)).toBe(true);
    const sharedVault = JSON.parse(fs.readFileSync(sharedPath, 'utf-8'));
    expect(sharedVault.ciphertext).toBe('sc');
  });

  it('should handle gmk resolution failure', async () => {
    fs.writeFileSync(vaultPath, JSON.stringify({}));
    vi.mocked(run.resolveGlobalMasterKey).mockRejectedValue(new Error('fail'));

    try {
      await shareCommand();
    } catch {}
    
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle decrypt local vault failure', async () => {
    const gmk = new Uint8Array(32);
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(gmk);
    fs.writeFileSync(vaultPath, JSON.stringify({}));
    vi.mocked(envelope.decryptLocalVault).mockRejectedValue(new Error('fail'));

    try {
      await shareCommand();
    } catch {}
    
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle prompt/encrypt failure', async () => {
    const gmk = new Uint8Array(32);
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(gmk);
    fs.writeFileSync(vaultPath, JSON.stringify({}));
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('SECRET=shared');
    vi.mocked(tui.promptForOtp).mockRejectedValue(new Error('prompt fail'));

    try {
      await shareCommand();
    } catch {}
    
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
