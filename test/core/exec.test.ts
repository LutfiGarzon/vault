import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { execWithEnv } from '../../src/core/exec.js';
import * as session from '../../src/core/session.js';
import { EventEmitter } from 'events';

vi.mock('child_process');
vi.mock('../../src/core/session.js');

describe('Exec Core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should spawn a process with injected environment', async () => {
    const mockChild = new EventEmitter() as any;
    vi.mocked(spawn).mockReturnValue(mockChild);
    
    const envVars = { 'SECRET': 'value' };
    const commandArgs = ['ls', '-la'];

    // We don't await because it waits for 'exit'
    execWithEnv(envVars, commandArgs);

    expect(spawn).toHaveBeenCalledWith('ls', ['-la'], expect.objectContaining({
      env: expect.objectContaining({ 'SECRET': 'value' })
    }));
  });

  it('should create a session if GMK is provided', async () => {
    const mockChild = new EventEmitter() as any;
    vi.mocked(spawn).mockReturnValue(mockChild);
    vi.mocked(session.createSession).mockResolvedValue('test-session-token');
    
    const gmk = new Uint8Array(32);
    execWithEnv({}, ['ls'], gmk);

    expect(session.createSession).toHaveBeenCalledWith(gmk);
    // Wait for promise microtasks
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(spawn).toHaveBeenCalledWith('ls', [], expect.objectContaining({
      env: expect.objectContaining({ 'VAULT_SESSION_TOKEN': 'test-session-token' })
    }));
  });
});
