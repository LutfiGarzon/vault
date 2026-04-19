import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { execWithEnv } from '../../src/core/exec.js';
import * as session from '../../src/core/session.js';
import { EventEmitter } from 'events';

vi.mock('child_process');
vi.mock('../../src/core/session.js');

describe('Exec Core', () => {
  let exitSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should spawn a process and handle exit', async () => {
    const mockChild = new EventEmitter() as any;
    vi.mocked(spawn).mockReturnValue(mockChild);
    
    const envVars = { 'SECRET': 'value' };
    const commandArgs = ['ls', '-la'];

    await execWithEnv(envVars, commandArgs);
    
    // Trigger exit
    mockChild.emit('exit', 0);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should handle subprocess error', async () => {
    const mockChild = new EventEmitter() as any;
    vi.mocked(spawn).mockReturnValue(mockChild);
    
    await execWithEnv({}, ['ls']);
    
    mockChild.emit('error', new Error('spawn enoent'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should spawn a subshell, handle exit and destroy session', async () => {
    const mockChild = new EventEmitter() as any;
    vi.mocked(spawn).mockReturnValue(mockChild);
    vi.mocked(session.createSession).mockResolvedValue('test-token');
    
    await execWithEnv({ 'SECRET': 'shell_val' }, [], new Uint8Array(32));

    expect(spawn).toHaveBeenCalledWith(process.env.SHELL || '/bin/sh', [], expect.any(Object));

    mockChild.emit('exit', 1);
    // wait for promise microtasks
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(session.destroySession).toHaveBeenCalledWith('test-token');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle subshell error', async () => {
    const mockChild = new EventEmitter() as any;
    vi.mocked(spawn).mockReturnValue(mockChild);
    
    await execWithEnv({}, []);
    
    mockChild.emit('error', new Error('failed'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle process with undefined exit code', async () => {
    const mockChild = new EventEmitter() as any;
    vi.mocked(spawn).mockReturnValue(mockChild);
    
    await execWithEnv({}, ['ls']);
    
    mockChild.emit('exit', null);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should handle subshell with undefined exit code', async () => {
    const mockChild = new EventEmitter() as any;
    vi.mocked(spawn).mockReturnValue(mockChild);
    
    await execWithEnv({}, []);
    
    mockChild.emit('exit', null);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
