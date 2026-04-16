import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import _sodium from 'libsodium-wrappers';
import { createSession, resolveSession, destroySession } from '../../src/core/session.js';

describe('Session Core', () => {
  const testDir = path.join(os.tmpdir(), 'vault-session-test-' + Math.random().toString(36).substring(7));

  beforeEach(async () => {
    await _sodium.ready;
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

  it('should create and resolve a session', async () => {
    const gmk = _sodium.randombytes_buf(_sodium.crypto_secretbox_KEYBYTES);
    const token = await createSession(gmk);
    
    expect(token).toBeDefined();
    
    const resolvedGmk = await resolveSession(token);
    expect(resolvedGmk).toEqual(gmk);
  });

  it('should destroy a session', async () => {
    const gmk = _sodium.randombytes_buf(_sodium.crypto_secretbox_KEYBYTES);
    const token = await createSession(gmk);
    
    await destroySession(token);
    
    const resolvedGmk = await resolveSession(token);
    expect(resolvedGmk).toBeNull();
  });

  it('should return null for invalid token', async () => {
    const resolvedGmk = await resolveSession('invalid-token');
    expect(resolvedGmk).toBeNull();
  });
});
