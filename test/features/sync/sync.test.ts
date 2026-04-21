import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncCommand } from '../../../src/features/sync/index.js';
import * as hardwareKey from '../../../src/core/hardware-key.js';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';
import _sodium from 'libsodium-wrappers';

vi.mock('../../../src/core/hardware-key.js');
vi.mock('@aws-sdk/client-kms');

describe('Sync Command', () => {
  const originalEnv = process.env;
  let exitSpy: any;
  let errorSpy: any;

  beforeEach(async () => {
    await _sodium.ready;
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should throw if --env is not provided', async () => {
    try {
      await syncCommand({});
    } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should throw if VAULT_KMS_CIPHERTEXT is missing', async () => {
    delete process.env.VAULT_KMS_CIPHERTEXT;
    try {
      await syncCommand({ env: 'qa' });
    } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should fail gracefully if AWS credentials are missing or expired', async () => {
    process.env.VAULT_KMS_CIPHERTEXT = 'b64dummy';
    const mockSend = vi.fn().mockRejectedValue(new Error('Could not load credentials from any providers'));
    KMSClient.prototype.send = mockSend as any;

    try {
      await syncCommand({ env: 'qa' });
    } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should decrypt KMS key and store it in the hardware enclave', async () => {
    process.env.VAULT_KMS_CIPHERTEXT = 'b64dummy';
    const dummyKey = new Uint8Array([10, 20, 30]);

    const mockSend = vi.fn().mockResolvedValue({ Plaintext: dummyKey });
    KMSClient.prototype.send = mockSend as any;

    vi.mocked(hardwareKey.storeHardwareKey).mockResolvedValue({ success: true });

    const sodiumSpy = vi.spyOn(_sodium, 'memzero').mockImplementation(() => {});

    await syncCommand({ env: 'qa' });

    expect(mockSend).toHaveBeenCalled();
    expect(hardwareKey.storeHardwareKey).toHaveBeenCalledWith(
      'VaultCLI',
      'com.vault.masterkey.qa',
      expect.any(String)
    );
    expect(sodiumSpy).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should fail if hardware key storage fails', async () => {
    process.env.VAULT_KMS_CIPHERTEXT = 'b64dummy';
    const dummyKey = new Uint8Array([10, 20, 30]);

    const mockSend = vi.fn().mockResolvedValue({ Plaintext: dummyKey });
    KMSClient.prototype.send = mockSend as any;

    vi.mocked(hardwareKey.storeHardwareKey).mockResolvedValue({ success: false, error: 'Keychain denied' });

    try {
      await syncCommand({ env: 'qa' });
    } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
