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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should spawn a process and resolve with exit code', async () => {
    const mockChild = new EventEmitter() as any;
    vi.mocked(spawn).mockReturnValue(mockChild);
    
    const envVars = { 'SECRET': 'value' };
    const commandArgs = ['ls', '-la'];

    const promise = execWithEnv(envVars, commandArgs);
    mockChild.emit('exit', 0);

    const code = await promise;
    expect(code).toBe(0);
  });

  it('should resolve with 1 on subprocess error', async () => {
    const mockChild = new EventEmitter() as any;
    vi.mocked(spawn).mockReturnValue(mockChild);
    
    const promise = execWithEnv({}, ['ls']);
    mockChild.emit('error', new Error('spawn enoent'));

    const code = await promise;
    expect(code).toBe(1);
  });

  it('should spawn a subshell, resolve with exit code, and destroy session', async () => {
    const mockChild = new EventEmitter() as any;
    vi.mocked(spawn).mockReturnValue(mockChild);
    vi.mocked(session.createSession).mockResolvedValue('test-token');
    
    const promise = execWithEnv({ 'SECRET': 'shell_val' }, [], new Uint8Array(32));

    // Wait for createSession mock to resolve before emitting
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(spawn).toHaveBeenCalledWith(process.env.SHELL || '/bin/sh', [], expect.any(Object));

    mockChild.emit('exit', 1);
    const code = await promise;
    
    // Wait for async destroySession in exit handler
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(session.destroySession).toHaveBeenCalledWith('test-token');
    expect(code).toBe(1);
  });

  it('should resolve with 1 on subshell error', async () => {
    const mockChild = new EventEmitter() as any;
    vi.mocked(spawn).mockReturnValue(mockChild);
    
    const promise = execWithEnv({}, []);
    mockChild.emit('error', new Error('failed'));

    const code = await promise;
    expect(code).toBe(1);
  });

  it('should handle process with null exit code', async () => {
    const mockChild = new EventEmitter() as any;
    vi.mocked(spawn).mockReturnValue(mockChild);
    
    const promise = execWithEnv({}, ['ls']);
    mockChild.emit('exit', null);

    const code = await promise;
    expect(code).toBe(0);
  });

  it('should handle subshell with null exit code', async () => {
    const mockChild = new EventEmitter() as any;
    vi.mocked(spawn).mockReturnValue(mockChild);
    
    const promise = execWithEnv({}, []);
    mockChild.emit('exit', null);

    const code = await promise;
    expect(code).toBe(0);
  });
});
