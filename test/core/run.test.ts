import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { resolveGlobalMasterKey, createLocalVault, runVault, recoverGlobalIdentity } from '../../src/core/run.js';
import * as session from '../../src/core/session.js';
import * as identity from '../../src/core/identity.js';
import * as envelope from '../../src/core/envelope.js';
import * as hardwareKey from '../../src/core/hardware-key.js';
import * as exec from '../../src/core/exec.js';
import * as p from '@clack/prompts';
import _sodium from 'libsodium-wrappers';

vi.mock('fs');
vi.mock('path');
vi.mock('dotenv');
vi.mock('../../src/core/session.js');
vi.mock('../../src/core/identity.js');
vi.mock('../../src/core/envelope.js');
vi.mock('../../src/core/hardware-key.js');
vi.mock('../../src/core/exec.js');
vi.mock('@clack/prompts');

describe('Run Core', () => {
  const originalEnv = process.env;
  let mockGmk: Uint8Array;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    await _sodium.ready;
    mockGmk = new Uint8Array([1, 2, 3]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('resolveGlobalMasterKey', () => {
    it('should return session GMK if VAULT_SESSION_TOKEN is present', async () => {
      process.env.VAULT_SESSION_TOKEN = 'test-token';
      vi.mocked(session.resolveSession).mockResolvedValue(mockGmk);

      const result = await resolveGlobalMasterKey();
      expect(result).toBe(mockGmk);
    });

    it('should initialize global identity if none exists', async () => {
      vi.mocked(identity.loadGlobalIdentity).mockReturnValue(null);
      vi.mocked(envelope.generateRecoveryKey).mockReturnValue('recovery-key');
      vi.mocked(envelope.generateHardwareKey).mockReturnValue('hw-key');
      vi.mocked(hardwareKey.storeHardwareKey).mockResolvedValue({ success: true });
      vi.mocked(envelope.setupGlobalIdentity).mockResolvedValue({ identity: {} as any, gmk: mockGmk });
      vi.mocked(p.password).mockResolvedValue('password123');

      const result = await resolveGlobalMasterKey();
      
      expect(identity.loadGlobalIdentity).toHaveBeenCalled();
      expect(p.password).toHaveBeenCalled();
      expect(envelope.setupGlobalIdentity).toHaveBeenCalledWith('password123', 'recovery-key', 'hw-key');
      expect(identity.saveGlobalIdentity).toHaveBeenCalled();
      expect(result).toBe(mockGmk);
    });

    it('should use provided password for initialization if given', async () => {
      vi.mocked(identity.loadGlobalIdentity).mockReturnValue(null);
      vi.mocked(envelope.generateRecoveryKey).mockReturnValue('recovery-key');
      vi.mocked(envelope.generateHardwareKey).mockReturnValue('hw-key');
      vi.mocked(hardwareKey.storeHardwareKey).mockResolvedValue({ success: false });
      vi.mocked(envelope.setupGlobalIdentity).mockResolvedValue({ identity: {} as any, gmk: mockGmk });

      const result = await resolveGlobalMasterKey('direct-password');
      
      expect(p.password).not.toHaveBeenCalled();
      expect(envelope.setupGlobalIdentity).toHaveBeenCalledWith('direct-password', 'recovery-key', undefined);
      expect(result).toBe(mockGmk);
    });

    it('should unlock existing global identity with hardware key', async () => {
      const mockIdentity = { keks: { hardware: {} } } as any;
      vi.mocked(identity.loadGlobalIdentity).mockReturnValue(mockIdentity);
      vi.mocked(hardwareKey.retrieveHardwareKey).mockResolvedValue('hw-key');
      vi.mocked(envelope.unlockGlobalMasterKey).mockResolvedValue(mockGmk);

      const result = await resolveGlobalMasterKey();

      expect(envelope.unlockGlobalMasterKey).toHaveBeenCalledWith(mockIdentity, undefined, 'hw-key');
      expect(result).toBe(mockGmk);
    });

    it('should fallback to password if hw key fails', async () => {
      const mockIdentity = { keks: { hardware: {} } } as any;
      vi.mocked(identity.loadGlobalIdentity).mockReturnValue(mockIdentity);
      vi.mocked(hardwareKey.retrieveHardwareKey).mockResolvedValue('hw-key');
      vi.mocked(envelope.unlockGlobalMasterKey)
        .mockRejectedValueOnce(new Error('Biometric mismatch'))
        .mockResolvedValueOnce(mockGmk);
      vi.mocked(p.password).mockResolvedValue('password123');

      const result = await resolveGlobalMasterKey();

      expect(p.password).toHaveBeenCalled();
      expect(envelope.unlockGlobalMasterKey).toHaveBeenCalledWith(mockIdentity, 'password123');
      expect(result).toBe(mockGmk);
    });

    it('should unlock existing identity with password if no hw key', async () => {
      const mockIdentity = { keks: {} } as any;
      vi.mocked(identity.loadGlobalIdentity).mockReturnValue(mockIdentity);
      vi.mocked(p.password).mockResolvedValue('password123');
      vi.mocked(envelope.unlockGlobalMasterKey).mockResolvedValue(mockGmk);

      const result = await resolveGlobalMasterKey();

      expect(envelope.unlockGlobalMasterKey).toHaveBeenCalledWith(mockIdentity, 'password123');
      expect(result).toBe(mockGmk);
    });
  });

  describe('recoverGlobalIdentity', () => {
    it('should derive GMK from recoveryKey and setup new identity', async () => {
      vi.mocked(envelope.deriveGmkFromRecoveryKey).mockResolvedValue(mockGmk);
      vi.mocked(envelope.reconstructGlobalIdentity).mockResolvedValue({ identity: {} as any });
      
      await recoverGlobalIdentity('test-recovery-key', 'new-password');

      expect(envelope.deriveGmkFromRecoveryKey).toHaveBeenCalledWith('test-recovery-key');
      expect(envelope.reconstructGlobalIdentity).toHaveBeenCalledWith(mockGmk, 'new-password');
      expect(identity.saveGlobalIdentity).toHaveBeenCalled();
    });

    it('should throw if recovery key is invalid', async () => {
      vi.mocked(envelope.deriveGmkFromRecoveryKey).mockRejectedValue(new Error('invalid key'));
      await expect(recoverGlobalIdentity('bad-key', 'pass')).rejects.toThrow('invalid key');
    });
  });

  describe('createLocalVault', () => {
    it('should create and write local vault', async () => {
      vi.mocked(identity.loadGlobalIdentity).mockReturnValue({ keks: {} } as any);
      vi.mocked(envelope.unlockGlobalMasterKey).mockResolvedValue(mockGmk);
      const mockPayload = { encryptedData: 'data' } as any;
      vi.mocked(envelope.generateLocalVault).mockResolvedValue(mockPayload);
      vi.mocked(path.resolve).mockReturnValue('/mock/path/.env.vault');

      await createLocalVault('SECRET=test', 'password');

      expect(envelope.generateLocalVault).toHaveBeenCalledWith('SECRET=test', mockGmk);
      expect(fs.writeFileSync).toHaveBeenCalledWith('/mock/path/.env.vault', JSON.stringify(mockPayload, null, 2), 'utf-8');
    });
  });

  describe('runVault', () => {
    it('should fail if no vaults exist', async () => {
      vi.mocked(path.resolve).mockReturnValue('/mock/.env.vault');
      vi.mocked(identity.getGlobalVaultPath).mockReturnValue('/mock/global.vault');
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

      await runVault(['ls']);

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should run command with decrypted envs from local and global vaults', async () => {
      vi.mocked(path.resolve).mockReturnValue('/mock/.env.vault');
      vi.mocked(identity.getGlobalVaultPath).mockReturnValue('/mock/global.vault');
      
      // Both exist
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      vi.mocked(identity.loadGlobalIdentity).mockReturnValue({ keks: {} } as any);
      vi.mocked(envelope.unlockGlobalMasterKey).mockResolvedValue(mockGmk);

      vi.mocked(fs.readFileSync).mockReturnValue('{}');
      vi.mocked(envelope.decryptLocalVault)
        .mockResolvedValueOnce('GLOBAL=1') // first call (global)
        .mockResolvedValueOnce('LOCAL=2'); // second call (local)
      
      vi.mocked(dotenv.parse).mockImplementation((str) => str === 'GLOBAL=1' ? { GLOBAL: '1' } : { LOCAL: '2' });

      await runVault(['ls']);

      expect(exec.execWithEnv).toHaveBeenCalledWith({ GLOBAL: '1', LOCAL: '2' }, ['ls'], mockGmk);
    });
  });
});
