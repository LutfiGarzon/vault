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
    await _sodium.ready;
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(testDir);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit called with ${code}`);
    });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('should ingest a shared vault', async () => {
    const transportPayload = { salt: 'aabb', nonce: 'ccdd', ciphertext: 'eeff' };
    fs.writeFileSync(transportPath, JSON.stringify(transportPayload));
    
    vi.mocked(tui.promptIngestOtp).mockResolvedValue('test-otp');
    vi.mocked(crypto.deriveKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(crypto.decryptPayload).mockResolvedValue('INGESTED=secret');
    vi.mocked(run.createLocalVault).mockResolvedValue(undefined);

    await ingestCommand('shared.vault');

    expect(crypto.decryptPayload).toHaveBeenCalled();
    expect(run.createLocalVault).toHaveBeenCalledWith('INGESTED=secret');
    expect(fs.existsSync(transportPath)).toBe(false); // Should be unlinked
  });
});
