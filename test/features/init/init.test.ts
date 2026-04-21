import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initCommand } from '../../../src/features/init/init.js';
import * as run from '../../../src/core/run.js';
import * as tui from '../../../src/features/init/tui.js';
import _sodium from 'libsodium-wrappers';
import { getGlobalVaultPath } from '../../../src/core/identity.js';
import { generateLocalVault } from '../../../src/core/envelope.js';

vi.mock('../../../src/core/run.js');
vi.mock('../../../src/features/init/tui.js');
vi.mock('../../../src/core/identity.js');
vi.mock('../../../src/core/envelope.js');
vi.mock('@clack/prompts');

describe('Init Feature', () => {
  const testDir = path.join(os.tmpdir(), 'vault-init-test-' + Math.random().toString(36).substring(7));

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

  it('should initialize a local vault from a file', async () => {
    const envFile = path.join(testDir, '.env');
    fs.writeFileSync(envFile, 'KEY=value\nOTHER=thing');
    
    vi.mocked(run.createLocalVault).mockResolvedValue(undefined);

    await initCommand({ file: '.env' });

    expect(run.createLocalVault).toHaveBeenCalledWith('KEY=value\nOTHER=thing', undefined, undefined);
  });

  it('should exit if file does not exist', async () => {
    try {
      await initCommand({ file: 'nonexistent.env' });
    } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should initialize via TUI if no file provided', async () => {
    vi.mocked(tui.runTui).mockResolvedValue({ selectedEnv: { TUI_KEY: 'tui_value' } });
    vi.mocked(run.createLocalVault).mockResolvedValue(undefined);

    await initCommand({});

    expect(tui.runTui).toHaveBeenCalled();
    expect(run.createLocalVault).toHaveBeenCalledWith('TUI_KEY=tui_value', undefined, undefined);
  });

  it('should perform global migration if global flag is true', async () => {
    vi.mocked(tui.runTui).mockResolvedValue({ selectedEnv: { TUI_KEY: 'tui_value' } });
    vi.mocked(run.resolveGlobalMasterKey).mockResolvedValue(new Uint8Array(32));
    vi.mocked(generateLocalVault).mockResolvedValue({} as any);
    vi.mocked(getGlobalVaultPath).mockReturnValue(path.join(testDir, '.vault', 'global.vault'));
    
    await initCommand({ global: true });

    expect(run.resolveGlobalMasterKey).toHaveBeenCalled();
    expect(generateLocalVault).toHaveBeenCalled();
    expect(fs.existsSync(path.join(testDir, '.vault', 'global.vault'))).toBe(true);
  });

  it('should initialize a local vault with --env flag mapped to specific environment', async () => {
    const envFile = path.join(testDir, '.env');
    fs.writeFileSync(envFile, 'QA=true');

    vi.mocked(run.createLocalVault).mockResolvedValue(undefined);

    await initCommand({ file: '.env', env: 'qa' });

    expect(run.createLocalVault).toHaveBeenCalledWith('QA=true', undefined, 'qa');
  });
});
