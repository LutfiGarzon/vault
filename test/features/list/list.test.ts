import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listCommand } from '../../../src/features/list/list.js';
import * as run from '../../../src/core/run.js';
import * as envelope from '../../../src/core/envelope.js';
import * as identity from '../../../src/core/identity.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('../../../src/core/run.js');
vi.mock('../../../src/core/envelope.js');
vi.mock('../../../src/core/identity.js');

describe('List Feature', () => {
  const testDir = path.join(os.tmpdir(), 'vault-list-test-' + Math.random().toString(36).substring(7));
  const vaultPath = path.join(testDir, '.env.vault');

  let exitSpy: any;
  let logSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code: number) => { throw new Error(`exit ${code}`) }) as any);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('should exit if no vaults exist', async () => {
    vi.mocked(identity.getGlobalVaultPath).mockReturnValue(path.join(testDir, 'global.vault'));
    // fs.existsSync is not mocked globally here, let it use real fs on testDir
    
    try {
      await listCommand({});
    } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should list masked keys from local vault', async () => {
    fs.writeFileSync(vaultPath, JSON.stringify({}));
    vi.mocked(identity.getGlobalVaultPath).mockReturnValue(path.join(testDir, 'global.vault'));
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('MY_SECRET=superpassword\nANOTHER=val');

    await listCommand({});

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('MY_SECRET'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('s••••••••d')); // masked
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ANOTHER'));
  });

  it('should show unmasked keys if --show-secrets is passed', async () => {
    fs.writeFileSync(vaultPath, JSON.stringify({}));
    vi.mocked(identity.getGlobalVaultPath).mockReturnValue(path.join(testDir, 'global.vault'));
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('MY_SECRET=superpassword');

    await listCommand({ showSecrets: true });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('superpassword'));
  });

  it('should only list variables from the specific environment vault via --env qa', async () => {
    const qaVaultPath = path.join(testDir, '.env.qa.vault');
    fs.writeFileSync(qaVaultPath, JSON.stringify({}));
    vi.mocked(identity.getGlobalVaultPath).mockReturnValue(path.join(testDir, 'global.vault'));
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(envelope.decryptLocalVault).mockResolvedValue('QA_ONLY=true');

    await listCommand({ env: 'qa' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('QA_ONLY'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('••••'));
  });
});
