import { describe, it, expect, beforeAll } from 'vitest';
import _sodium from 'libsodium-wrappers';
import { 
  setupGlobalIdentity, 
  unlockGlobalMasterKey, 
  generateLocalVault, 
  decryptLocalVault,
  generateRecoveryKey
} from '../../src/core/envelope.js';

describe('Envelope Core', () => {
  beforeAll(async () => {
    await _sodium.ready;
  });

  it('should setup and unlock global identity with password', async () => {
    const password = 'test-password';
    const recoveryKey = generateRecoveryKey();
    
    const { identity, gmk } = await setupGlobalIdentity(password, recoveryKey);
    
    expect(identity.salt).toBeDefined();
    expect(identity.keks.password).toBeDefined();
    expect(identity.keks.recovery).toBeDefined();
    
    const unlockedGmk = await unlockGlobalMasterKey(identity, password);
    expect(unlockedGmk).toEqual(gmk);
  });

  it('should setup and unlock global identity with hardware key', async () => {
    const password = 'test-password';
    const recoveryKey = generateRecoveryKey();
    const hardwareKey = 'test-hw-key';
    
    const { identity, gmk } = await setupGlobalIdentity(password, recoveryKey, hardwareKey);
    
    expect(identity.keks.hardware).toBeDefined();
    
    const unlockedGmk = await unlockGlobalMasterKey(identity, undefined, hardwareKey);
    expect(unlockedGmk).toEqual(gmk);
  });

  it('should encrypt and decrypt local vault', async () => {
    const password = 'test-password';
    const recoveryKey = generateRecoveryKey();
    const { gmk } = await setupGlobalIdentity(password, recoveryKey);
    
    const plaintext = 'SECRET_DATA=12345';
    const vault = await generateLocalVault(plaintext, gmk);
    
    expect(vault.nonce).toBeDefined();
    expect(vault.ciphertext).toBeDefined();
    expect(vault.globalDek).toBeDefined();
    
    const decrypted = await decryptLocalVault(vault, gmk);
    expect(decrypted).toBe(plaintext);
  });

  it('should throw error on incorrect password', async () => {
    const password = 'test-password';
    const recoveryKey = generateRecoveryKey();
    const { identity } = await setupGlobalIdentity(password, recoveryKey);
    
    await expect(unlockGlobalMasterKey(identity, 'wrong-password'))
      .rejects.toThrow('Incorrect master password');
  });
});
