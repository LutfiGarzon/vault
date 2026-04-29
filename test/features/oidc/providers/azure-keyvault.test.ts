import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AzureKeyVaultProvider } from '../../../../src/features/oidc/providers/azure-keyvault.js';

describe('AzureKeyVaultProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should have name "azure"', () => {
    const provider = new AzureKeyVaultProvider(
      'tenant-id', 'client-id', 'https://vault.vault.azure.net',
      'key-name', 'base64cipher'
    );
    expect(provider.name).toBe('azure');
  });

  it('should exchange JWT for Azure AD token and call Key Vault decrypt', async () => {
    const provider = new AzureKeyVaultProvider(
      'my-tenant', 'my-client', 'https://myvault.vault.azure.net',
      'my-key', 'dmVyeSBzZWNyZXQ='
    );

    const fetchSpy = vi.spyOn(global, 'fetch')
      // First fetch: token exchange
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'azure-ad-token'
        })
      } as Response)
      // Second fetch: key vault decrypt
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: 'cGxhaW50ZXh0' // base64 of "plaintext"
        })
      } as Response);

    const result = await provider.decrypt('ci-jwt-token');

    expect(result).toEqual(new Uint8Array([112, 108, 97, 105, 110, 116, 101, 120, 116])); // "plaintext"

    // First call: token exchange
    expect(fetchSpy).toHaveBeenNthCalledWith(1,
      'https://login.microsoftonline.com/my-tenant/oauth2/v2.0/token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded'
        })
      })
    );

    // Second call: key vault decrypt
    expect(fetchSpy).toHaveBeenNthCalledWith(2,
      'https://myvault.vault.azure.net/keys/my-key/decrypt?api-version=7.4',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer azure-ad-token',
          'Content-Type': 'application/json'
        })
      })
    );
  });

  it('should throw if token exchange fails', async () => {
    const provider = new AzureKeyVaultProvider(
      'my-tenant', 'my-client', 'https://myvault.vault.azure.net',
      'my-key', 'cipher'
    );

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      statusText: 'Unauthorized',
      status: 401
    } as Response);

    await expect(provider.decrypt('bad-jwt')).rejects.toThrow('Azure AD token exchange');
  });

  it('should throw if key vault decrypt fails', async () => {
    const provider = new AzureKeyVaultProvider(
      'my-tenant', 'my-client', 'https://myvault.vault.azure.net',
      'my-key', 'cipher'
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

    await expect(provider.decrypt('jwt')).rejects.toThrow('Azure Key Vault decrypt');
  });
});
