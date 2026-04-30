import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncCommand } from '../../../src/features/sync/index.js';
import * as hardwareKey from '../../../src/core/hardware-key.js';
import _sodium from 'libsodium-wrappers';

vi.mock('../../../src/core/hardware-key.js');

describe('Sync Command', () => {
  const originalEnv = process.env;
  let exitSpy: any;

  beforeEach(async () => {
    await _sodium.ready;
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should throw if --env is not provided', async () => {
    try { await syncCommand({}); } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should throw if VAULT_KMS_CIPHERTEXT is missing', async () => {
    delete process.env.VAULT_KMS_CIPHERTEXT;
    try { await syncCommand({ env: 'qa' }); } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should throw if AWS credentials are missing', async () => {
    process.env.VAULT_KMS_CIPHERTEXT = 'b64dummy';
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    try { await syncCommand({ env: 'qa' }); } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should fail gracefully if KMS returns 403', async () => {
    process.env.VAULT_KMS_CIPHERTEXT = 'b64dummy';
    process.env.AWS_ACCESS_KEY_ID = 'AKIA_TEST';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.AWS_REGION = 'us-east-1';

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => ''
    } as Response);

    try { await syncCommand({ env: 'qa' }); } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should decrypt KMS key and store it in the hardware enclave', async () => {
    process.env.VAULT_KMS_CIPHERTEXT = 'b64dummy';
    process.env.AWS_ACCESS_KEY_ID = 'AKIA_TEST';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.AWS_REGION = 'us-east-1';

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Plaintext: 'Cgoc' }) // base64 of [10, 20, 30]
    } as Response);

    vi.mocked(hardwareKey.storeHardwareKey).mockResolvedValue({ success: true });
    vi.spyOn(_sodium, 'memzero').mockImplementation(() => {});

    await syncCommand({ env: 'qa' });

    expect(hardwareKey.storeHardwareKey).toHaveBeenCalledWith(
      'VaultCLI',
      'com.vault.masterkey.qa',
      expect.any(String)
    );
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should fail if hardware key storage fails', async () => {
    process.env.VAULT_KMS_CIPHERTEXT = 'b64dummy';
    process.env.AWS_ACCESS_KEY_ID = 'AKIA_TEST';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.AWS_REGION = 'us-east-1';

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Plaintext: 'Cgoc' })
    } as Response);

    vi.mocked(hardwareKey.storeHardwareKey).mockResolvedValue({ success: false, error: 'Keychain denied' });

    try { await syncCommand({ env: 'qa' }); } catch {}
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
