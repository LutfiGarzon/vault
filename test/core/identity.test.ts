import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getVaultRoot, saveGlobalIdentity, loadGlobalIdentity, GlobalIdentity } from '../../src/core/identity.js';

describe('Identity Core', () => {
  const testDir = path.join(os.tmpdir(), 'vault-test-' + Math.random().toString(36).substring(7));

  beforeEach(() => {
    vi.stubEnv('XDG_CONFIG_HOME', testDir);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    vi.unstubAllEnvs();
  });

  it('should return the correct vault root', () => {
    expect(getVaultRoot()).toBe(testDir);
  });

  it('should save and load global identity', () => {
    const identity: GlobalIdentity = {
      salt: 'test-salt',
      keks: {
        password: { nonce: 'n1', ciphertext: 'c1' },
        recovery: { nonce: 'n2', ciphertext: 'c2' }
      }
    };

    saveGlobalIdentity(identity);
    const loaded = loadGlobalIdentity();
    expect(loaded).toEqual(identity);
  });

  it('should return null if identity does not exist', () => {
    expect(loadGlobalIdentity()).toBeNull();
  });
});
