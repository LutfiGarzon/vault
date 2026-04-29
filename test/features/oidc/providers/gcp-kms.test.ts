import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GcpKmsProvider } from '../../../../src/features/oidc/providers/gcp-kms.js';

describe('GcpKmsProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should have name "gcp"', () => {
    const provider = new GcpKmsProvider(
      '123456789', 'my-pool', 'github-provider',
      'my-project', 'global', 'my-keyring', 'my-key',
      'base64cipher'
    );
    expect(provider.name).toBe('gcp');
  });

  it('should exchange JWT for GCP access token and call KMS decrypt', async () => {
    const provider = new GcpKmsProvider(
      '123456789', 'my-pool', 'github-provider',
      'my-project', 'global', 'my-keyring', 'my-key',
      'dmVyeSBzZWNyZXQ='
    );

    const fetchSpy = vi.spyOn(global, 'fetch')
      // First fetch: STS token exchange
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'gcp-access-token'
        })
      } as Response)
      // Second fetch: KMS decrypt
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          plaintext: 'cGxhaW50ZXh0' // base64 of "plaintext"
        })
      } as Response);

    const result = await provider.decrypt('ci-jwt-token');

    expect(result).toEqual(new Uint8Array([112, 108, 97, 105, 110, 116, 101, 120, 116]));

    // First call: STS token exchange
    expect(fetchSpy).toHaveBeenNthCalledWith(1,
      'https://sts.googleapis.com/v1/token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    );

    // Second call: KMS decrypt
    expect(fetchSpy).toHaveBeenNthCalledWith(2,
      'https://cloudkms.googleapis.com/v1/projects/my-project/locations/global/keyRings/my-keyring/cryptoKeys/my-key:decrypt',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer gcp-access-token',
          'Content-Type': 'application/json'
        })
      })
    );
  });

  it('should throw if STS token exchange fails', async () => {
    const provider = new GcpKmsProvider(
      '123', 'pool', 'provider', 'proj', 'global', 'ring', 'key', 'cipher'
    );

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      statusText: 'Forbidden',
      status: 403
    } as Response);

    await expect(provider.decrypt('bad-jwt')).rejects.toThrow('GCP STS token exchange');
  });

  it('should throw if KMS decrypt fails', async () => {
    const provider = new GcpKmsProvider(
      '123', 'pool', 'provider', 'proj', 'global', 'ring', 'key', 'cipher'
    );

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token' })
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        statusText: 'Key not found',
        status: 404
      } as Response);

    await expect(provider.decrypt('jwt')).rejects.toThrow('GCP KMS decrypt');
  });
});
