import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storeHardwareKey, retrieveHardwareKey } from '../../src/core/hardware-key.js';
import * as cp from 'child_process';
import os from 'os';
import fs from 'fs';
import * as identity from '../../src/core/identity.js';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFile: vi.fn((file, args, cb) => {
    if (args[0] === 'store') {
      if (args[3] === 'fail-key') cb({ message: 'fail' }, { stdout: '' }, '');
      else cb(null, { stdout: 'SUCCESS\n' }, '');
    } else if (args[0] === 'retrieve') {
      if (args[2] === 'fail-account') cb({ message: 'fail' }, { stdout: '' }, '');
      else cb(null, { stdout: 'my-hardware-key\n' }, '');
    }
  })
}));
vi.mock('os');
vi.mock('fs');
vi.mock('../../src/core/identity.js');

describe('Hardware Key Core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(os.platform).mockReturnValue('darwin');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(cp.execSync).mockReturnValue(Buffer.from('')); 
    vi.mocked(identity.getVaultRoot).mockReturnValue('/mock/vault/root');
  });

  it('should store hardware key using swift bridge', async () => {
    const result = await storeHardwareKey('test-service', 'test-account', 'key123');
    expect(result.success).toBe(true);
    expect(cp.execFile).toHaveBeenCalledWith(expect.any(String), ['store', 'test-service', 'test-account', 'key123'], expect.any(Function));
  });

  it('should handle store hardware key failure', async () => {
    const result = await storeHardwareKey('test-service', 'test-account', 'fail-key');
    expect(result.success).toBe(false);
  });

  it('should retrieve hardware key using swift bridge', async () => {
    const result = await retrieveHardwareKey('test-service', 'test-account');
    expect(result).toBe('my-hardware-key');
    expect(cp.execFile).toHaveBeenCalledWith(expect.any(String), ['retrieve', 'test-service', 'test-account'], expect.any(Function));
  });

  it('should return null if retrieve fails', async () => {
    const result = await retrieveHardwareKey('test-service', 'fail-account');
    expect(result).toBeNull();
  });

  it('should return null/false on non-darwin platforms', async () => {
    vi.mocked(os.platform).mockReturnValue('linux');
    const storeRes = await storeHardwareKey('service', 'account', 'key');
    expect(storeRes.success).toBe(false);
    
    const retRes = await retrieveHardwareKey('service', 'account');
    expect(retRes).toBeNull();
  });

  it('should test missing entitlements fallback', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false); // Entitlements file check
    vi.mocked(cp.execSync).mockImplementationOnce(() => { throw new Error('not signed'); });
    await retrieveHardwareKey('test-service', 'test-account');
    // Ensure we reached the codesign fallback without throwing
  });

  it('should handle completely failed ad-hoc signing', async () => {
    vi.mocked(cp.execSync).mockImplementation(() => { throw new Error('not signed'); });
    await retrieveHardwareKey('test-service', 'test-account');
  });

  it('should return error if execFile fails with string stderr', async () => {
    vi.mocked(cp.execFile).mockImplementationOnce((file, args, cb: any) => {
      cb({ message: 'fail' }, { stdout: '' }, { stderr: 'some stderr error' });
    });
    const result = await storeHardwareKey('test', 'test', 'fail-key');
    expect(result.success).toBe(false);
  });
});