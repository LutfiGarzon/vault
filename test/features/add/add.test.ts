import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { addCommand } from '../../../src/features/add/add.js';
import * as run from '../../../src/core/run.js';
import * as envelope from '../../../src/core/envelope.js';
import * as tui from '../../../src/features/add/tui.js';
import _sodium from 'libsodium-wrappers';

vi.mock('../../../src/core/run.js');
vi.mock('../../../src/core/envelope.js');
vi.mock('../../../src/features/add/tui.js');

describe('Add Feature', () => {
  const testDir = path.join(os.tmpdir(), 'vault-add-test-' + Math.random().toString(36).substring(7));
  const vaultPath = path.join(testDir, '.env.vault');

  let exitSpy: any;
  let cwdSpy: any;

  beforeEach(async () => {
    await _sodium.ready;
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(testDir);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('should exit if vault does not exist', async () => {
    try {
      await addCommand('KEY', 'VAL', {});
    } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should add a key to a new local vault', async () => {
    const gmk = new Uint8Array(32);
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(gmk);
    
    const initialPayload = { nonce: 'n', ciphertext: 'c', globalDek: { nonce: 'dn', ciphertext: 'dc' } };
    fs.writeFileSync(vaultPath, JSON.stringify(initialPayload));
    
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('EXISTING=value');
    vi.mocked(envelope.generateLocalVault).mockResolvedValue({
        nonce: 'n2',
        ciphertext: 'c2',
        globalDek: { nonce: 'dn2', ciphertext: 'dc2' }
    });

    await addCommand('NEW_KEY', 'new_value', { global: false });

    expect(envelope.decryptLocalVault).toHaveBeenCalled();
    expect(envelope.generateLocalVault).toHaveBeenCalledWith(
        expect.stringContaining('NEW_KEY=new_value'),
        gmk
    );
    expect(envelope.generateLocalVault).toHaveBeenCalledWith(
        expect.stringContaining('EXISTING=value'),
        gmk
    );
    
    const savedVault = JSON.parse(fs.readFileSync(vaultPath, 'utf-8'));
    expect(savedVault.nonce).toBe('n2');
  });

  it('should prompt for value if not provided', async () => {
    const gmk = new Uint8Array(32);
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(gmk);
    vi.mocked(tui.promptForValue).mockResolvedValue('prompted_value');
    
    const initialPayload = { nonce: 'n', ciphertext: 'c', globalDek: { nonce: 'dn', ciphertext: 'dc' } };
    fs.writeFileSync(vaultPath, JSON.stringify(initialPayload));
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('');
    vi.mocked(envelope.generateLocalVault).mockResolvedValue(initialPayload);

    await addCommand('PROMPTED_KEY', undefined, { global: false });

    expect(tui.promptForValue).toHaveBeenCalledWith('PROMPTED_KEY');
    expect(envelope.generateLocalVault).toHaveBeenCalledWith(
        'PROMPTED_KEY=prompted_value',
        gmk
    );
  });

  it('should handle gmk resolution failure', async () => {
    fs.writeFileSync(vaultPath, JSON.stringify({}));
    vi.mocked(run.resolveGlobalMasterKey).mockRejectedValue(new Error('fail'));

    try {
      await addCommand('KEY', 'VAL', {});
    } catch {}
    
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
