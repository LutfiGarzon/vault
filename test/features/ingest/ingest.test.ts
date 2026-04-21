import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ingestCommand } from '../../../src/features/ingest/ingest.js';
import * as run from '../../../src/core/run.js';
import * as crypto from '../../../src/core/crypto.js';
import * as tui from '../../../src/features/ingest/tui.js';
import _sodium from 'libsodium-wrappers';

vi.mock('../../../src/core/run.js');
vi.mock('../../../src/core/crypto.js');
vi.mock('../../../src/features/ingest/tui.js');
vi.mock('@clack/prompts');

describe('Ingest Feature', () => {
  const testDir = path.join(os.tmpdir(), 'vault-ingest-test-' + Math.random().toString(36).substring(7));
  const transportPath = path.join(testDir, 'shared.vault');

  let exitSpy: any;
  let cwdSpy: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    await _sodium.ready;
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(testDir);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: number) => { throw new Error(`exit ${code}`) }) as any);
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('should exit if file not found', async () => {
    try {
      await ingestCommand('nonexistent.vault');
    } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit if JSON is invalid', async () => {
    fs.writeFileSync(transportPath, 'not-json');
    try {
      await ingestCommand('shared.vault');
    } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit if decryption fails', async () => {
    const transportPayload = { salt: 'aabb', nonce: 'ccdd', ciphertext: 'eeff' };
    fs.writeFileSync(transportPath, JSON.stringify(transportPayload));
    
    vi.mocked(tui.promptIngestOtp).mockResolvedValue('test-otp');
    vi.mocked(crypto.deriveKey).mockRejectedValue(new Error('fail'));

    try {
      await ingestCommand('shared.vault');
    } catch {}
    
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should ingest a shared vault into a new vault', async () => {
    const transportPayload = { salt: 'aabb', nonce: 'ccdd', ciphertext: 'eeff' };
    fs.writeFileSync(transportPath, JSON.stringify(transportPayload));
    
    vi.mocked(tui.promptIngestOtp).mockResolvedValue('test-otp');
    vi.mocked(crypto.deriveKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(crypto.decryptPayload).mockResolvedValue('INGESTED=secret');
    vi.mocked(run.createLocalVault).mockResolvedValue(undefined);

    await ingestCommand('shared.vault');

    expect(crypto.decryptPayload).toHaveBeenCalled();
    expect(run.createLocalVault).toHaveBeenCalledWith('INGESTED=secret', undefined, undefined);
    expect(fs.existsSync(transportPath)).toBe(false); // Should be unlinked
  });

  it('should confirm overwrite if vault exists, and proceed if true', async () => {
    const vaultPath = path.join(testDir, '.env.vault');
    fs.writeFileSync(vaultPath, '{}');
    
    const transportPayload = { salt: 'aabb', nonce: 'ccdd', ciphertext: 'eeff' };
    fs.writeFileSync(transportPath, JSON.stringify(transportPayload));
    
    vi.mocked(tui.promptIngestOtp).mockResolvedValue('test-otp');
    vi.mocked(tui.confirmOverwrite).mockResolvedValue(true);
    vi.mocked(crypto.deriveKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(crypto.decryptPayload).mockResolvedValue('INGESTED=secret');
    vi.mocked(run.createLocalVault).mockResolvedValue(undefined);

    await ingestCommand('shared.vault');

    expect(tui.confirmOverwrite).toHaveBeenCalled();
    expect(run.createLocalVault).toHaveBeenCalledWith('INGESTED=secret', undefined, undefined);
    expect(fs.existsSync(transportPath)).toBe(false);
  });

  it('should exit if confirm overwrite is false', async () => {
    const vaultPath = path.join(testDir, '.env.vault');
    fs.writeFileSync(vaultPath, '{}');
    
    const transportPayload = { salt: 'aabb', nonce: 'ccdd', ciphertext: 'eeff' };
    fs.writeFileSync(transportPath, JSON.stringify(transportPayload));
    
    vi.mocked(tui.promptIngestOtp).mockResolvedValue('test-otp');
    vi.mocked(tui.confirmOverwrite).mockResolvedValue(false);
    vi.mocked(crypto.deriveKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(crypto.decryptPayload).mockResolvedValue('INGESTED=secret');

    try {
      await ingestCommand('shared.vault');
    } catch {}

    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(fs.existsSync(transportPath)).toBe(true);
  });

  it('should not unlink transport file or modify vault in dry-run mode', async () => {
    const transportPayload = { salt: 'aabb', nonce: 'ccdd', ciphertext: 'eeff' };
    fs.writeFileSync(transportPath, JSON.stringify(transportPayload));
    
    vi.mocked(tui.promptIngestOtp).mockResolvedValue('test-otp');
    vi.mocked(crypto.deriveKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(crypto.decryptPayload).mockResolvedValue('INGESTED=secret');
    
    await ingestCommand('shared.vault', { dryRun: true });

    expect(fs.existsSync(transportPath)).toBe(true);
    expect(run.createLocalVault).not.toHaveBeenCalled();
  });
});
